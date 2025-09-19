import { App, TFile, MarkdownRenderer, Notice, Component } from 'obsidian';
import { writeFileSync, mkdirSync, existsSync, copyFileSync } from 'fs';
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
			const filteredFiles = this.filterFilesByGlob(files);

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

			// Export filtered files
			for (const file of filteredFiles) {
				const isIndexPage = this.settings.indexPage && file.path === this.settings.indexPage;

				if (isIndexPage) {
					await this.exportFileToHtml(file, templateContent, 'index.html');
				} else {
					await this.exportFileToHtml(file, templateContent);
				}
				exportedCount++;
			}

			// Export index page if it wasn't included in the filtered files
			if (this.settings.indexPage) {
				const indexFile = this.app.vault.getAbstractFileByPath(this.settings.indexPage);
				if (indexFile instanceof TFile && !filteredFiles.includes(indexFile)) {
					await this.exportFileToHtml(indexFile, templateContent, 'index.html');
					exportedCount++;
				}
			}

			new Notice(`HTML export completed! Exported ${exportedCount} files.`);
		} catch (error) {
			new Notice('HTML export failed: ' + (error as Error).message);
		}
	}

	private getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	private filterFilesByGlob(files: TFile[]): TFile[] {
		if (!this.settings.includePatterns.trim()) {
			return files;
		}

		const patterns = this.settings.includePatterns
			.split('\n')
			.map(p => p.trim())
			.filter(p => p.length > 0);

		return files.filter(file => {
			return micromatch.isMatch(file.path, patterns);
		});
	}

	private async exportFileToHtml(file: TFile, templateContent: string, customFileName?: string): Promise<void> {
		try {
			const content = await this.app.vault.read(file);

			// Process internal links in the raw markdown BEFORE rendering
			const processedMarkdown = this.linkResolver.processLinksInMarkdown(content, file.path);

			// Create a temporary div for rendering
			const tempDiv = document.createElement('div');

			// Use Obsidian's markdown renderer on the processed markdown
			await MarkdownRenderer.renderMarkdown(
				processedMarkdown,
				tempDiv,
				file.path,
				this.component
			);

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

		} catch (error) {
			throw new Error(`Error exporting file ${file.path}: ${(error as Error).message}`);
		}
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
}
