import { App, TFile, MarkdownRenderer, Notice, Component } from 'obsidian';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import { dirname, join } from 'path';
import * as micromatch from 'micromatch';
import { HtmlExportSettings } from '../types/settings';
import { LinkResolver } from './link-resolver';

export class HtmlExportService {
	private app: App;
	private settings: HtmlExportSettings;
	private component: Component;
	private linkResolver: LinkResolver;

	constructor(app: App, settings: HtmlExportSettings, component: Component) {
		this.app = app;
		this.settings = settings;
		this.component = component;
		this.linkResolver = new LinkResolver(app);
	}

	async exportVault(): Promise<void> {
		if (!this.settings.exportPath) {
			new Notice('Please set an export path in settings first');
			return;
		}

		new Notice('HTML export started...');

		try {
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

			let exportedCount = 0;

			// Export filtered files
			for (const file of filteredFiles) {
				const isIndexPage = this.settings.indexPage && file.path === this.settings.indexPage;

				if (isIndexPage) {
					await this.exportFileToHtml(file, 'index.html');
				} else {
					await this.exportFileToHtml(file);
				}
				exportedCount++;
			}

			// Export index page if it wasn't included in the filtered files
			if (this.settings.indexPage) {
				const indexFile = this.app.vault.getAbstractFileByPath(this.settings.indexPage);
				if (indexFile instanceof TFile && !filteredFiles.includes(indexFile)) {
					await this.exportFileToHtml(indexFile, 'index.html');
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

	private async exportFileToHtml(file: TFile, customFileName?: string): Promise<void> {
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

			// Get the final HTML content
			const htmlContent = this.wrapInHtmlTemplate(processedHtml, file.basename);

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

	private wrapInHtmlTemplate(content: string, title: string): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
            line-height: 1.6;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            color: #333;
        }
        h1, h2, h3, h4, h5, h6 {
            margin-top: 1.5em;
            margin-bottom: 0.5em;
        }
        code {
            background-color: #f4f4f4;
            padding: 2px 4px;
            border-radius: 3px;
        }
        pre {
            background-color: #f4f4f4;
            padding: 10px;
            border-radius: 5px;
            overflow-x: auto;
        }
        blockquote {
            border-left: 4px solid #ddd;
            margin: 0;
            padding-left: 20px;
            color: #666;
        }
        .dead-link {
            color: #0645ad; /* Wikipedia link blue */
            text-decoration: line-through;
            cursor: default; /* No pointer cursor */
        }
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
	}
}