import { App, TFile } from 'obsidian';
import slug from 'slug';

export class LinkResolver {
	private app: App;
	private pathToSlugMap: Map<string, string> = new Map();
	private slugToPathMap: Map<string, string> = new Map();
	private exportedFiles: Set<string> = new Set();
	private readonly imageExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'];
	private readonly videoExtensions = ['.mp4', '.webm', '.mov', '.m4v', '.ogg'];

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

	// Convert internal links and images in markdown content BEFORE rendering
	processLinksInMarkdown(markdownContent: string, sourcePath: string): string {
		// First, process media embeds: ![[image.jpg]] or ![[video.mp4|width]] etc.
		let processedContent = this.processMediaEmbedsInMarkdown(markdownContent, sourcePath);

		// Then process text links: [[link]] or [[link|display text]]
		const linkRegex = /\[\[([^\]]+)\]\]/g;

		return processedContent.replace(linkRegex, (match, linkContent) => {
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

	// Process media embeds in markdown content (images & videos)
	processMediaEmbedsInMarkdown(markdownContent: string, sourcePath: string): string {
		const embedRegex = /!\[\[([^\]]+)\]\]/g;

		return markdownContent.replace(embedRegex, (_match, embedContent) => {
			const parts = embedContent.split('|').map((p: string) => p.trim());
			const targetPath = parts[0];

			const { altText, width } = this.parseEmbedParameters(parts.slice(1));
			const resolved = this.resolveMediaPath(targetPath, sourcePath);

			if (resolved) {
				if (resolved.type === 'image') {
					return this.generateImageHtml(resolved.file, sourcePath, width, altText);
				}

				if (resolved.type === 'video') {
					return this.generateVideoHtml(resolved.file, sourcePath, width, altText);
				}
			}

			const fallbackType = this.getExtensionType(targetPath);
			const icon = fallbackType === 'video' ? '🎞️' : '🖼️';
			const cssClass = fallbackType === 'video' ? 'broken-video' : 'broken-image';
			return `<span class="${cssClass}" title="Media not found: ${targetPath}">${icon} ${targetPath}</span>`;
		});
	}

	private parseEmbedParameters(params: string[]): { altText: string; width?: number } {
		let altText = '';
		let width: number | undefined;

		for (const param of params) {
			const numParam = parseInt(param);
			if (!isNaN(numParam) && numParam > 0) {
				width = numParam;
			} else if (param.length > 0) {
				altText = param;
			}
		}

		return { altText, width };
	}

	private resolveMediaPath(mediaPath: string, sourcePath: string): { file: TFile; type: 'image' | 'video' } | null {
		const file = this.app.metadataCache.getFirstLinkpathDest(mediaPath, sourcePath);

		if (file instanceof TFile) {
			const lowerPath = file.path.toLowerCase();
			if (this.imageExtensions.some(ext => lowerPath.endsWith(ext))) {
				return { file, type: 'image' };
			}
			if (this.videoExtensions.some(ext => lowerPath.endsWith(ext))) {
				return { file, type: 'video' };
			}
		}

		return null;
	}

	// Generate HTML for an image
	generateImageHtml(imageFile: TFile, sourcePath: string, width?: number, altText?: string): string {
		const imageName = imageFile.name;
		const relativeImagePath = this.getRelativePath(sourcePath, `assets/${imageName}`);
		const alt = altText || imageFile.basename;

		const attributes = [`src="${relativeImagePath}"`, `alt="${alt}"`];
		if (width && width > 0) {
			attributes.push(`style="width: ${width}px;"`);
		}

		return `<img ${attributes.join(' ')}>`;
	}

	private generateVideoHtml(videoFile: TFile, sourcePath: string, width?: number, titleText?: string): string {
		const videoName = videoFile.name;
		const relativeVideoPath = this.getRelativePath(sourcePath, `assets/${videoName}`);
		const attributes = ['controls'];

		if (titleText) {
			attributes.push(`title="${titleText}"`);
		}

		if (width && width > 0) {
			attributes.push(`style="width: ${width}px;"`);
		}

		const mimeType = this.getVideoMimeType(videoName);
		const sources = `<source src="${relativeVideoPath}"${mimeType ? ` type="${mimeType}"` : ''}>`;

		return `<video ${attributes.join(' ')}>${sources}Your browser does not support the video tag.</video>`;
	}

	private getVideoMimeType(fileName: string): string | undefined {
		const lower = fileName.toLowerCase();
		if (lower.endsWith('.mp4') || lower.endsWith('.m4v')) {
			return 'video/mp4';
		}
		if (lower.endsWith('.webm')) {
			return 'video/webm';
		}
		if (lower.endsWith('.mov')) {
			return 'video/quicktime';
		}
		if (lower.endsWith('.ogg')) {
			return 'video/ogg';
		}
		return undefined;
	}

	private getExtensionType(path: string): 'image' | 'video' | null {
		const lower = path.toLowerCase();
		if (this.imageExtensions.some(ext => lower.endsWith(ext))) {
			return 'image';
		}
		if (this.videoExtensions.some(ext => lower.endsWith(ext))) {
			return 'video';
		}
		return null;
	}

	// Get all media references from markdown content
	getAllMediaReferences(markdownContent: string, sourcePath: string): TFile[] {
		const embedRegex = /!\[\[([^\]]+)\]\]/g;
		const mediaFiles: TFile[] = [];
		let match;

		while ((match = embedRegex.exec(markdownContent)) !== null) {
			const targetPath = match[1].split('|')[0].trim();
			const resolved = this.resolveMediaPath(targetPath, sourcePath);

			if (resolved && !mediaFiles.some(f => f.path === resolved.file.path)) {
				mediaFiles.push(resolved.file);
			}
		}

		return mediaFiles;
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
