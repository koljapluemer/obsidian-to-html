import { Plugin } from 'obsidian';
import { HtmlExportSettings, DEFAULT_SETTINGS } from './types/settings';
import { HtmlExportSettingTab } from './ui/settings-tab';
import { HtmlExportService } from './services/html-export';
import { TemplateService } from './services/template-service';

export default class HtmlExportPlugin extends Plugin {
	settings: HtmlExportSettings;
	private exportService: HtmlExportService;
	private templateService: TemplateService;

	async onload() {
		await this.loadSettings();

		this.exportService = new HtmlExportService(this.app, this.settings, this);
		this.templateService = new TemplateService(this.app);

		this.addCommand({
			id: 'export-vault-to-html',
			name: 'Export vault to HTML',
			callback: () => {
				this.exportService.exportVault();
			}
		});

		this.addCommand({
			id: 'add-default-template',
			name: 'Add default template note',
			callback: () => {
				this.createDefaultTemplate();
			}
		});

		this.addSettingTab(new HtmlExportSettingTab(this.app, this));
	}

	onunload() {
		// Cleanup if needed
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
		// Update the export service with new settings
		this.exportService = new HtmlExportService(this.app, this.settings, this);
	}

	async createDefaultTemplate(): Promise<void> {
		try {
			const templateFile = await this.templateService.createDefaultTemplateNote();

			// Set this template as the active template in settings
			this.settings.templateNote = templateFile.path;
			await this.saveSettings();

		} catch (error) {
			console.error('Failed to create default template:', error);
		}
	}
}