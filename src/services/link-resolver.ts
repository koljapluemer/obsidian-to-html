import { App, TFile } from 'obsidian';
import slug from 'slug';

export class LinkResolver {
	private app: App;
	private pathToSlugMap: Map<string, string> = new Map();
	private slugToPathMap: Map<string, string> = new Map();
	private exportedFiles: Set<string> = new Set();

	constructor(app: App) {
		this.app = app;
	}

	// Build mappings for all files that will be exported
	buildPathMappings(files: TFile[]): void {
		this.pathToSlugMap.clear();
		this.slugToPathMap.clear();
		this.exportedFiles.clear();

		for (const file of files) {
			const sluggedPath = this.createSluggedPath(file.path);
			this.pathToSlugMap.set(file.path, sluggedPath);
			this.slugToPathMap.set(sluggedPath, file.path);
			this.exportedFiles.add(file.path);
		}
	}

	// Convert file path to slugged HTML path
	getSluggedPath(filePath: string): string {
		return this.pathToSlugMap.get(filePath) || this.createSluggedPath(filePath);
	}

	// Resolve internal link text (like "[[some note]]" or "[[some note#heading]]") to actual file path
	resolveInternalLink(linkText: string, sourcePath: string): { path: string | null; subpath?: string } {
		// Remove the [[ ]] brackets and any display text after |
		const cleanLinkText = linkText.replace(/^\[\[|\]\]$/g, '').split('|')[0].trim();

		// Split linktext into path and subpath (heading/block)
		const [linkpath, subpath] = cleanLinkText.split('#');

		// Use Obsidian's API to resolve the linkpath
		const targetFile = this.app.metadataCache.getFirstLinkpathDest(linkpath.trim(), sourcePath);

		if (targetFile instanceof TFile) {
			return {
				path: targetFile.path,
				subpath: subpath?.trim()
			};
		}

		return { path: null };
	}

	// Check if a file path will be included in the export
	isFileExported(filePath: string): boolean {
		return this.exportedFiles.has(filePath);
	}

	// Convert internal links in markdown content to proper markdown links BEFORE rendering
	processLinksInMarkdown(markdownContent: string, sourcePath: string): string {
		// Match Obsidian internal links: [[link]] or [[link|display text]]
		const linkRegex = /\[\[([^\]]+)\]\]/g;

		return markdownContent.replace(linkRegex, (match, linkContent) => {
			const parts = linkContent.split('|');
			const linkText = parts[0].trim();
			const displayText = parts[1]?.trim() || linkText.split('#')[0]; // Use link text without subpath if no display text

			// Resolve the link to actual file path
			const resolved = this.resolveInternalLink(`[[${linkText}]]`, sourcePath);

			if (resolved.path) {
				// Check if the target file will be exported
				if (!this.isFileExported(resolved.path)) {
					// Link to file that won't be exported - mark as broken with custom scheme
					return `[${displayText}](obsidian-broken:${encodeURIComponent(linkText)})`;
				}

				const sluggedTargetPath = this.getSluggedPath(resolved.path);
				let htmlPath = sluggedTargetPath.replace(/\.md$/, '.html');

				// Add anchor for subpath (heading/block)
				if (resolved.subpath) {
					const sluggedSubpath = slug(resolved.subpath);
					htmlPath += `#${sluggedSubpath}`;
				}

				// Calculate relative path from source to target
				const relativePath = this.getRelativePath(sourcePath, htmlPath);

				// Return standard markdown link syntax
				return `[${displayText}](${relativePath})`;
			}

			// If link can't be resolved, mark as broken with custom scheme
			return `[${displayText}](obsidian-broken:${encodeURIComponent(linkText)})`;
		});
	}

	// Post-process HTML to convert broken link anchors to styled spans
	processDeadLinksInHtml(htmlContent: string): string {
		// Match anchor tags with obsidian-broken: scheme
		const brokenLinkRegex = /<a[^>]*href="obsidian-broken:([^"]*)"[^>]*>(.*?)<\/a>/g;

		return htmlContent.replace(brokenLinkRegex, (match, encodedOriginalLink, displayText) => {
			const originalLink = decodeURIComponent(encodedOriginalLink);
			return `<span class="dead-link" title="Broken link: ${originalLink}">${displayText}</span>`;
		});
	}

	private createSluggedPath(filePath: string): string {
		const pathParts = filePath.split('/');
		const sluggedParts = pathParts.map(part => {
			if (part.endsWith('.md')) {
				// Remove .md extension, slug the name, then add it back
				const nameWithoutExt = part.slice(0, -3);
				return slug(nameWithoutExt) + '.md';
			}
			return slug(part);
		});

		return sluggedParts.join('/');
	}

	private getRelativePath(fromPath: string, toPath: string): string {
		const fromParts = fromPath.split('/').slice(0, -1); // Remove filename
		const toParts = toPath.split('/');

		// Find common prefix
		let commonLength = 0;
		while (
			commonLength < fromParts.length &&
			commonLength < toParts.length &&
			fromParts[commonLength] === toParts[commonLength]
		) {
			commonLength++;
		}

		// Build relative path
		const upLevels = fromParts.length - commonLength;
		const downPath = toParts.slice(commonLength);

		const relativeParts = ['..'.repeat(upLevels), ...downPath].filter(Boolean);

		return relativeParts.join('/') || './';
	}
}