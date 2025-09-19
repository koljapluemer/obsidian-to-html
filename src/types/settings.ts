export interface HtmlExportSettings {
	exportPath: string;
	includePatterns: string;
	indexPage: string;
}

export const DEFAULT_SETTINGS: HtmlExportSettings = {
	exportPath: '',
	includePatterns: '**/*.md',
	indexPage: ''
};