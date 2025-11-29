import { App, TFile, Notice } from 'obsidian';
import Handlebars from 'handlebars';

export interface NoteTemplateData {
	note: {
		title: string;
		content: string;
		frontmatter: Record<string, unknown>;
	};
}

export class TemplateService {
	private app: App;

	constructor(app: App) {
		this.app = app;
	}

	// Load default template - use the actual template file content you edited!
	loadDefaultTemplate(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{{note.title}}</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/light.css">
</head>

<body>
    <header>
        <h1>{{note.title}}</h1>
    </header>
    <main>
        {{{note.content}}}
    </main>
</body>
</html>`;
	}

	// Render a template with note data
	async renderTemplate(templateContent: string, noteData: NoteTemplateData): Promise<string> {
		try {
			const template = Handlebars.compile(templateContent);
			return template(noteData);
		} catch (error) {
			throw new Error(`Template rendering failed: ${(error as Error).message}`);
		}
	}

	// Extract frontmatter from a file
	extractFrontmatter(file: TFile): Record<string, unknown> {
		const cache = this.app.metadataCache.getFileCache(file);
		return cache?.frontmatter || {};
	}

	// Create note template data from a file and its rendered content
	createNoteData(file: TFile, renderedContent: string): NoteTemplateData {
		const frontmatter = this.extractFrontmatter(file);

		return {
			note: {
				title: file.basename,
				content: renderedContent,
				frontmatter: frontmatter
			}
		};
	}

	// Create and open a default template note
	async createDefaultTemplateNote(): Promise<TFile> {
		const templateContent = this.loadDefaultTemplate();
		const templateName = 'HTML Export Template.md';

		// Check if template already exists
		const existingFile = this.app.vault.getAbstractFileByPath(templateName);
		if (existingFile instanceof TFile) {
			new Notice('Template note already exists. Opening existing template.');
			// Open the existing file
			const leaf = this.app.workspace.getUnpinnedLeaf();
			await leaf.openFile(existingFile);
			return existingFile;
		}

		try {
			// Create the template note with just the HTML template content
			const templateFile = await this.app.vault.create(templateName, templateContent);

			// Open the template for editing
			const leaf = this.app.workspace.getUnpinnedLeaf();
			await leaf.openFile(templateFile);

			new Notice('Default template created and opened for editing');
			return templateFile;

		} catch (error) {
			throw new Error(`Failed to create template note: ${(error as Error).message}`);
		}
	}
}