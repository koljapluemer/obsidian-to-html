import { App, TFile, MarkdownRenderer, Notice, Component } from 'obsidian';
import { writeFileSync, mkdirSync, existsSync, readdirSync, unlinkSync } from 'fs';
import { dirname, join } from 'path';
import * as micromatch from 'micromatch';
import { HtmlExportSettings } from '../types/settings';
import { LinkResolver } from './link-resolver';
import { TemplateService } from './template-service';

export class HtmlExportService {
	private app: App;
	private settings: HtmlExportSettings;
	private component: Component;
	private linkResolver: LinkResolver;
	private templateService: TemplateService;

	constructor(app: App, settings: HtmlExportSettings, component: Component) {
		this.app = app;
		this.settings = settings;
		this.component = component;
		this.linkResolver = new LinkResolver(app);
		this.templateService = new TemplateService(app);
	}

	async exportVault(): Promise<void> {
		if (!this.settings.exportPath) {
			new Notice('Please set an export path in settings first');
			return;
		}

		if (!this.settings.templateNote) {
			new Notice('Please select a template note in settings first');
			return;
		}

		new Notice('HTML export started...');

		try {
			// Load the template first
			const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateNote);
			if (!(templateFile instanceof TFile)) {
				new Notice('Template note not found. Please select a valid template.');
				return;
			}

			const templateContent = await this.app.vault.read(templateFile);

			const files = this.getMarkdownFiles();
			const filteredFiles = await this.filterFilesByGlob(files);

			// Collect all files that will be exported (including index page)
			const allExportFiles = [...filteredFiles];
			if (this.settings.indexPage) {
				const indexFile = this.app.vault.getAbstractFileByPath(this.settings.indexPage);
				if (indexFile instanceof TFile && !filteredFiles.includes(indexFile)) {
					allExportFiles.push(indexFile);
				}
			}

			if (allExportFiles.length === 0) {
				new Notice('No files to export');
				return;
			}

			// Build link mappings for all files that will be exported
			this.linkResolver.buildPathMappings(allExportFiles);

			// Collect and copy all media assets (images, video, ...)
			await this.copyMediaAssets(allExportFiles);

			let exportedCount = 0;
			const exportedHtmlPaths = new Set<string>();

			// Export filtered files
			for (const file of filteredFiles) {
				const isIndexPage = this.settings.indexPage && file.path === this.settings.indexPage;

				const outputPath = isIndexPage
					? await this.exportFileToHtml(file, templateContent, 'index.html')
					: await this.exportFileToHtml(file, templateContent);
				exportedHtmlPaths.add(outputPath);
				exportedCount++;
			}

			// Export index page if it wasn't included in the filtered files
			if (this.settings.indexPage) {
				const indexFile = this.app.vault.getAbstractFileByPath(this.settings.indexPage);
				if (indexFile instanceof TFile && !filteredFiles.includes(indexFile)) {
					const outputPath = await this.exportFileToHtml(indexFile, templateContent, 'index.html');
					exportedHtmlPaths.add(outputPath);
					exportedCount++;
				}
			}

			this.removeStaleHtmlFiles(exportedHtmlPaths);

			new Notice(`HTML export completed! Exported ${exportedCount} files.`);
		} catch (error) {
			new Notice('HTML export failed: ' + (error as Error).message);
		}
	}

	private getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	private async filterFilesByGlob(files: TFile[]): Promise<TFile[]> {
		if (!this.settings.includePatterns.trim()) {
			return files;
		}

		const patterns = this.settings.includePatterns
			.split('\n')
			.map(p => p.trim())
			.filter(p => p.length > 0);

		const globFiltered = files.filter(file => {
			return micromatch.isMatch(file.path, patterns);
		});

		// If no content filter is specified, return glob-filtered results
		if (!this.settings.onlyIncludeNotesContaining.trim()) {
			return globFiltered;
		}

		// Apply content filtering
		const contentFiltered: TFile[] = [];
		for (const file of globFiltered) {
			try {
				const content = await this.app.vault.read(file);
				if (content.includes(this.settings.onlyIncludeNotesContaining)) {
					contentFiltered.push(file);
				}
			} catch (error) {
				// Skip files that can't be read
				console.warn(`Could not read file ${file.path} for content filtering: ${(error as Error).message}`);
			}
		}

		return contentFiltered;
	}

	private async exportFileToHtml(file: TFile, templateContent: string, customFileName?: string): Promise<string> {
		try {
			const content = await this.app.vault.read(file);

			// Apply last horizontal rule exclusion if enabled
			const processedContent = this.settings.excludeLastHorizontalRule
				? this.processLastHorizontalRuleExclusion(content)
				: content;

			// Process internal links in the raw markdown BEFORE rendering
			const processedMarkdown = this.linkResolver.processLinksInMarkdown(processedContent, file.path);

			// Create a temporary div for rendering
			const tempDiv = document.createElement('div');

			// Use Obsidian's markdown renderer on the processed markdown
			await MarkdownRenderer.renderMarkdown(
				processedMarkdown,
				tempDiv,
				file.path,
				this.component
			);

			// Strip target attributes added by renderer so links open in same tab
			this.removeNewTabTargets(tempDiv);

			// Post-process HTML to convert broken link anchors to styled spans
			const processedHtml = this.linkResolver.processDeadLinksInHtml(tempDiv.innerHTML);

			// Create note data for template
			const noteData = this.templateService.createNoteData(file, processedHtml);

			// Render with the template
			const htmlContent = await this.templateService.renderTemplate(templateContent, noteData);

			// Calculate output path
			let outputPath: string;

			if (customFileName) {
				// Use custom filename (e.g., index.html) in export root
				outputPath = join(this.settings.exportPath, customFileName);
			} else {
				// Use slugified path mapping
				const sluggedPath = this.linkResolver.getSluggedPath(file.path);
				const outputFileName = sluggedPath.replace(/\.md$/, '.html');
				outputPath = join(this.settings.exportPath, outputFileName);
			}

			// Ensure the directory exists using Node.js fs
			const dirPath = dirname(outputPath);

			if (!existsSync(dirPath)) {
				mkdirSync(dirPath, { recursive: true });
			}

			// Write the file using Node.js fs for true filesystem access
			writeFileSync(outputPath, htmlContent, 'utf8');

			return outputPath;

		} catch (error) {
			throw new Error(`Error exporting file ${file.path}: ${(error as Error).message}`);
		}
	}

	private removeNewTabTargets(container: HTMLElement): void {
		const anchors = container.querySelectorAll<HTMLAnchorElement>('a[target="_blank"]');
		anchors.forEach(anchor => {
			anchor.removeAttribute('target');
			const rel = anchor.getAttribute('rel');
			if (rel) {
				const filtered = rel
					.split(' ')
					.map(token => token.trim())
					.filter(token => token.length > 0 && token.toLowerCase() !== 'noopener' && token.toLowerCase() !== 'noreferrer');
				if (filtered.length > 0) {
					anchor.setAttribute('rel', filtered.join(' '));
				} else {
					anchor.removeAttribute('rel');
				}
			}
		});
	}

	private async copyMediaAssets(files: TFile[]): Promise<void> {
		try {
			const allMediaFiles = new Set<TFile>();

			// Collect all media references from all markdown files
			for (const file of files) {
				const content = await this.app.vault.read(file);
				const mediaRefs = this.linkResolver.getAllMediaReferences(content, file.path);

				for (const mediaFile of mediaRefs) {
					allMediaFiles.add(mediaFile);
				}
			}

			if (allMediaFiles.size === 0) {
				return; // No media to copy
			}

			// Create assets directory
			const assetsDir = join(this.settings.exportPath, 'assets');
			if (!existsSync(assetsDir)) {
				mkdirSync(assetsDir, { recursive: true });
			}

			// Copy each media file
			for (const mediaFile of allMediaFiles) {
				const sourceBuffer = await this.app.vault.readBinary(mediaFile);
				const targetPath = join(assetsDir, mediaFile.name);

				// Write binary data to target location
				writeFileSync(targetPath, Buffer.from(sourceBuffer));
			}

			if (allMediaFiles.size > 0) {
				console.log(`Copied ${allMediaFiles.size} media assets to ${assetsDir}`);
			}

		} catch (error) {
			throw new Error(`Error copying media assets: ${(error as Error).message}`);
		}
	}

	private removeStaleHtmlFiles(exportedHtmlPaths: Set<string>): void {
		if (!existsSync(this.settings.exportPath)) {
			return;
		}

		const staleFiles: string[] = [];
		const directories: string[] = [this.settings.exportPath];

		while (directories.length > 0) {
			const currentDir = directories.pop();
			if (!currentDir) continue;
			const entries = readdirSync(currentDir, { withFileTypes: true });

			for (const entry of entries) {
				const fullPath = join(currentDir, entry.name);

				if (entry.isDirectory()) {
					if (entry.name === 'assets') {
						continue;
					}
					directories.push(fullPath);
					continue;
				}

				if (!entry.isFile()) {
					continue;
				}

				if (!entry.name.toLowerCase().endsWith('.html')) {
					continue;
				}

				if (!exportedHtmlPaths.has(fullPath)) {
					staleFiles.push(fullPath);
				}
			}
		}

		for (const filePath of staleFiles) {
			try {
				unlinkSync(filePath);
			} catch (error) {
				console.warn(`Failed to remove stale file ${filePath}: ${(error as Error).message}`);
			}
		}

		if (staleFiles.length > 0) {
			console.log(`Removed ${staleFiles.length} stale HTML files from ${this.settings.exportPath}`);
		}
	}

	private processLastHorizontalRuleExclusion(content: string): string {
		// Step 1: Detect and extract frontmatter
		const frontmatterMatch = content.match(
			/^---\r?\n([\s\S]*?)\r?\n---\r?\n/
		);

		let frontmatter = '';
		let bodyContent = content;

		if (frontmatterMatch) {
			frontmatter = frontmatterMatch[0];
			bodyContent = content.slice(frontmatterMatch[0].length);
		}

		// Step 2: Find last '---' in body content (not in code blocks)
		const lastHrIndex = this.findLastHorizontalRule(bodyContent);

		// Step 3: Truncate if found
		if (lastHrIndex !== -1) {
			bodyContent = bodyContent.slice(0, lastHrIndex).trimEnd();
		}

		return frontmatter + bodyContent;
	}

	private findLastHorizontalRule(content: string): number {
		// Find all potential '---' occurrences that are valid horizontal rules
		// A valid horizontal rule is '---' on its own line, not inside code blocks

		const lines = content.split(/\r?\n/);
		let inCodeBlock = false;
		let lastHrLineIndex = -1;

		for (let i = 0; i < lines.length; i++) {
			const line = lines[i].trim();

			// Track code block boundaries (both ``` and ~~~ style)
			if (line.startsWith('```') || line.startsWith('~~~')) {
				inCodeBlock = !inCodeBlock;
				continue;
			}

			// Skip if we're inside a code block
			if (inCodeBlock) {
				continue;
			}

			// Check if this line is a horizontal rule
			// Valid horizontal rule: exactly '---' (possibly with trailing spaces)
			if (line === '---' || line.match(/^---\s*$/)) {
				lastHrLineIndex = i;
			}
		}

		// Convert line index back to character index
		if (lastHrLineIndex === -1) {
			return -1;
		}

		// Calculate character position of the start of the line
		let charIndex = 0;
		for (let i = 0; i < lastHrLineIndex; i++) {
			charIndex += lines[i].length + 1; // +1 for the newline character
		}

		return charIndex;
	}
}
