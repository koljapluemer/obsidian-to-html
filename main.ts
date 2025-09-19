import { App, Notice, Plugin, PluginSettingTab, Setting, TFile, MarkdownRenderer, SuggestModal } from 'obsidian';
import { dirname, join } from 'path';
import { writeFileSync, mkdirSync, existsSync } from 'fs';
import * as micromatch from 'micromatch';

interface HtmlExportSettings {
	exportPath: string;
	includePatterns: string;
	indexPage: string;
}

const DEFAULT_SETTINGS: HtmlExportSettings = {
	exportPath: '',
	includePatterns: '**/*.md',
	indexPage: ''
}

export default class HtmlExportPlugin extends Plugin {
	settings: HtmlExportSettings;

	async onload() {
		await this.loadSettings();

		this.addCommand({
			id: 'export-vault-to-html',
			name: 'Export vault to HTML',
			callback: () => {
				this.exportVaultToHtml();
			}
		});

		this.addSettingTab(new HtmlExportSettingTab(this.app, this));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	async exportVaultToHtml() {
		if (!this.settings.exportPath) {
			new Notice('Please set an export path in settings first');
			return;
		}

		new Notice('HTML export started...');

		try {
			const files = this.getMarkdownFiles();
			const filteredFiles = this.filterFilesByGlob(files);

			if (filteredFiles.length === 0 && !this.settings.indexPage) {
				new Notice('No files match the include patterns');
				return;
			}

			let exportedCount = 0;
			for (const file of filteredFiles) {
				// Check if this is the index page
				const isIndexPage = this.settings.indexPage && file.path === this.settings.indexPage;

				if (isIndexPage) {
					// Export index page to root as index.html
					await this.exportFileToHtml(file, 'index.html');
				} else {
					// Export regular file to its normal path
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
			new Notice('HTML export failed: ' + error.message);
		}
	}

	getMarkdownFiles(): TFile[] {
		return this.app.vault.getMarkdownFiles();
	}

	filterFilesByGlob(files: TFile[]): TFile[] {
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

	async exportFileToHtml(file: TFile, customFileName?: string): Promise<void> {
		try {
			const content = await this.app.vault.read(file);
			console.log('Read file content length:', content.length);

			// Create a temporary div for rendering
			const tempDiv = document.createElement('div');

			// Use Obsidian's markdown renderer
			await MarkdownRenderer.renderMarkdown(
				content,
				tempDiv,
				file.path,
				this
			);

			// Get the HTML content
			const htmlContent = this.wrapInHtmlTemplate(tempDiv.innerHTML, file.basename);
			console.log('Generated HTML length:', htmlContent.length);

			// Calculate output path using absolute filesystem paths
			let outputPath: string;

			if (customFileName) {
				// Use custom filename (e.g., index.html) in export root
				outputPath = join(this.settings.exportPath, customFileName);
			} else {
				// Use normal path mapping
				const relativePath = file.path;
				const outputFileName = relativePath.replace(/\.md$/, '.html');
				outputPath = join(this.settings.exportPath, outputFileName);
			}

			console.log('Attempting to write to:', outputPath);

			// Ensure the directory exists using Node.js fs
			const dirPath = dirname(outputPath);
			console.log('Ensuring directory exists:', dirPath);

			if (!existsSync(dirPath)) {
				mkdirSync(dirPath, { recursive: true });
				console.log('Created directory:', dirPath);
			}

			// Write the file using Node.js fs for true filesystem access
			writeFileSync(outputPath, htmlContent, 'utf8');
			console.log('Successfully wrote file:', outputPath);

		} catch (error) {
			console.error('Error exporting file:', file.path, error);
			throw error;
		}
	}

	wrapInHtmlTemplate(content: string, title: string): string {
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
    </style>
</head>
<body>
    ${content}
</body>
</html>`;
	}
}

class HtmlExportSettingTab extends PluginSettingTab {
	plugin: HtmlExportPlugin;

	constructor(app: App, plugin: HtmlExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'HTML Export Settings'});

		new Setting(containerEl)
			.setName('Export Path')
			.setDesc('Folder where HTML files will be exported')
			.addText(text => text
				.setPlaceholder('e.g., /Users/username/Documents/my-site')
				.setValue(this.plugin.settings.exportPath)
				.onChange(async (value) => {
					this.plugin.settings.exportPath = value;
					await this.plugin.saveSettings();
				}))
			.addButton(button => button
				.setButtonText('Browse...')
				.setTooltip('Select export folder')
				.onClick(async () => {
					try {
						// Use Electron's dialog API for folder selection (desktop-only)
						const electronWindow = window as Window & { require?: NodeRequire };
						const electron = electronWindow.require?.('electron');
						if (!electron) {
							new Notice('File picker not available in this environment');
							return;
						}

						const { dialog } = electron.remote || electron;
						const result = await dialog.showOpenDialog({
							properties: ['openDirectory', 'createDirectory'],
							title: 'Select Export Folder'
						});

						if (!result.canceled && result.filePaths.length > 0) {
							const selectedPath = result.filePaths[0];
							this.plugin.settings.exportPath = selectedPath;
							await this.plugin.saveSettings();
							// Refresh the display to show the new path
							this.display();
						}
					} catch (error) {
						new Notice('File picker not available: ' + error.message);
					}
				}));

		new Setting(containerEl)
			.setName('Include Patterns')
			.setDesc('Unix glob patterns for files/folders to include (one per line)')
			.addTextArea(text => text
				.setPlaceholder('**/*.md\nfolder1/**\n!folder2/**')
				.setValue(this.plugin.settings.includePatterns)
				.onChange(async (value) => {
					this.plugin.settings.includePatterns = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Index Page')
			.setDesc('Select a note to use as index.html')
			.addText(text => {
				text
					.setPlaceholder('Click button to select...')
					.setValue(this.plugin.settings.indexPage)
					.setDisabled(true);
			})
			.addButton(button => button
				.setButtonText('Select Note')
				.setTooltip('Choose a note for index.html')
				.onClick(() => {
					new IndexPageSuggestModal(this.app, (selectedFile) => {
						this.plugin.settings.indexPage = selectedFile.path;
						this.plugin.saveSettings();
						this.display(); // Refresh the display to show selected file
					}).open();
				}))
			.addButton(button => button
				.setButtonText('Clear')
				.setTooltip('Clear index page selection')
				.onClick(async () => {
					this.plugin.settings.indexPage = '';
					await this.plugin.saveSettings();
					this.display(); // Refresh the display
				}));
	}
}

class IndexPageSuggestModal extends SuggestModal<TFile> {
	private onSelectCallback: (file: TFile) => void;

	constructor(app: App, onSelect: (file: TFile) => void) {
		super(app);
		this.onSelectCallback = onSelect;
		this.setPlaceholder('Type to search for a note...');
		this.setInstructions([
			{ command: '↑↓', purpose: 'to navigate' },
			{ command: '↵', purpose: 'to select' },
			{ command: 'esc', purpose: 'to dismiss' }
		]);
	}

	getSuggestions(query: string): TFile[] {
		const markdownFiles = this.app.vault.getMarkdownFiles();

		if (!query) {
			return markdownFiles.slice(0, 20); // Show first 20 files when no query
		}

		const lowerQuery = query.toLowerCase();
		return markdownFiles
			.filter(file =>
				file.path.toLowerCase().includes(lowerQuery) ||
				file.basename.toLowerCase().includes(lowerQuery)
			)
			.sort((a, b) => {
				// Prioritize matches in filename over path
				const aBasenameMatch = a.basename.toLowerCase().includes(lowerQuery);
				const bBasenameMatch = b.basename.toLowerCase().includes(lowerQuery);

				if (aBasenameMatch && !bBasenameMatch) return -1;
				if (!aBasenameMatch && bBasenameMatch) return 1;

				return a.path.localeCompare(b.path);
			})
			.slice(0, 50); // Limit to 50 results
	}

	renderSuggestion(file: TFile, el: HTMLElement): void {
		el.createEl('div', { text: file.basename, cls: 'suggestion-title' });
		if (file.path !== file.basename) {
			el.createEl('small', { text: file.path, cls: 'suggestion-note' });
		}
	}

	onChooseSuggestion(file: TFile): void {
		this.onSelectCallback(file);
	}
}
