import { App, SuggestModal, TFile } from 'obsidian';

export class IndexPageSuggestModal extends SuggestModal<TFile> {
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