import { App, PluginSettingTab, Setting } from 'obsidian';
import type HtmlExportPlugin from '../main';
import { FilePicker } from '../utils/file-picker';
import { IndexPageSuggestModal } from '../modals/index-page-modal';

export class HtmlExportSettingTab extends PluginSettingTab {
	plugin: HtmlExportPlugin;

	constructor(app: App, plugin: HtmlExportPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();
		containerEl.createEl('h2', { text: 'HTML Export Settings' });

		this.createExportPathSetting(containerEl);
		this.createIncludePatternsSetting(containerEl);
		this.createIndexPageSetting(containerEl);
		this.createTemplateNoteSetting(containerEl);
	}

	private createExportPathSetting(containerEl: HTMLElement): void {
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
					const selectedPath = await FilePicker.selectFolder();
					if (selectedPath) {
						this.plugin.settings.exportPath = selectedPath;
						await this.plugin.saveSettings();
						this.display(); // Refresh the display to show the new path
					}
				}));
	}

	private createIncludePatternsSetting(containerEl: HTMLElement): void {
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
	}

	private createIndexPageSetting(containerEl: HTMLElement): void {
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

	private createTemplateNoteSetting(containerEl: HTMLElement): void {
		new Setting(containerEl)
			.setName('Template Note')
			.setDesc('Select a note to use as HTML template (required for export)')
			.addText(text => {
				text
					.setPlaceholder('Click button to select...')
					.setValue(this.plugin.settings.templateNote)
					.setDisabled(true);
			})
			.addButton(button => button
				.setButtonText('Select Template')
				.setTooltip('Choose a template note')
				.onClick(() => {
					new IndexPageSuggestModal(this.app, (selectedFile) => {
						this.plugin.settings.templateNote = selectedFile.path;
						this.plugin.saveSettings();
						this.display(); // Refresh the display to show selected file
					}).open();
				}))
			.addButton(button => button
				.setButtonText('Add Default')
				.setTooltip('Create and use default template')
				.onClick(async () => {
					// This will be implemented in the command
					await (this.plugin as any).createDefaultTemplate();
					this.display(); // Refresh the display
				}))
			.addButton(button => button
				.setButtonText('Clear')
				.setTooltip('Clear template selection')
				.onClick(async () => {
					this.plugin.settings.templateNote = '';
					await this.plugin.saveSettings();
					this.display(); // Refresh the display
				}));
	}
}