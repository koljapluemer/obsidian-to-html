export interface HtmlExportSettings {
	exportPath: string;
	includePatterns: string;
	indexPage: string;
	templateNote: string;
	onlyIncludeNotesContaining: string;
	excludeLastHorizontalRule: boolean;
}

export const DEFAULT_SETTINGS: HtmlExportSettings = {
	exportPath: '',
	includePatterns: '**/*.md',
	indexPage: '',
	templateNote: '',
	onlyIncludeNotesContaining: '',
	excludeLastHorizontalRule: false
};