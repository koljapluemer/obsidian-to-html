export interface HtmlExportSettings {
	exportPath: string;
	includePatterns: string;
	indexPage: string;
	templateNote: string;
}

export const DEFAULT_SETTINGS: HtmlExportSettings = {
	exportPath: '',
	includePatterns: '**/*.md',
	indexPage: '',
	templateNote: ''
};