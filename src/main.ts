import { Plugin } from 'obsidian';
import { HtmlExportSettings, DEFAULT_SETTINGS } from './types/settings';
import { HtmlExportSettingTab } from './ui/settings-tab';
import { HtmlExportService } from './services/html-export';

export default class HtmlExportPlugin extends Plugin {
	settings: HtmlExportSettings;
	private exportService: HtmlExportService;

	async onload() {
		await this.loadSettings();

		this.exportService = new HtmlExportService(this.app, this.settings, this);

		this.addCommand({
			id: 'export-vault-to-html',
			name: 'Export vault to HTML',
			callback: () => {
				this.exportService.exportVault();
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
}