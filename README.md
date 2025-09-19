# Obsidian to HTML

<<<<<<< HEAD
Export your Obsidian vault to static HTML files with embedded media (images & video) support and link resolution.
=======

https://github.com/user-attachments/assets/bf1bf917-cbe3-4120-a6df-5ed2dcd77346


Export your Obsidian vault to static HTML files with full image support and link resolution.
>>>>>>> 90e71d5f5d41417ce18bd0dafe08b479874b93ee

## Features

- Export selected notes using glob patterns
- Convert `![[image.jpg]]` and `![[video.mp4]]` to proper HTML with width support (`![[media|400]]`)
- Convert `[[note links]]` to relative HTML links
- Copy only referenced media (images & video) to output
- Customizable HTML templates using Handlebars
- GitHub Pages ready output

## Installation

1. Download the latest release files: `main.js`, `manifest.json`
2. Create folder: `VaultFolder/.obsidian/plugins/obsidian-to-html/`
3. Copy files to that folder
4. Restart Obsidian and enable the plugin

## Usage

1. **Create template**: Run command "Add default template note" or create your own HTML template with `{{note.title}}` and `{{{note.content}}}` placeholders
2. **Configure export** (in Settings):
   - Set export path (e.g., `/Users/you/Sites/my-vault`)
   - Select template note
   - Set include patterns (e.g., `posts/**/*.md`, `public/**/*.md`)
   - Optionally set index page
3. **Export**: Run command "Export vault to HTML"

**Tip**: To verify media export, create a note with both an image embed (`![[image.png|Alt text|300]]`) and a video embed (`![[clip.mp4|640]]`), then use "Export vault to HTML" and open the generated HTML to confirm the image renders and the video plays with controls.

## GitHub Pages Deployment

### 1. Repository Setup
```bash
# Create new repository on GitHub (public for free GitHub Pages)
git clone https://github.com/yourusername/your-vault-site
cd your-vault-site
```

### 2. Export Configuration
- **Export path**: Set to your local repository folder
- **Include patterns**: Select which folders to publish (e.g., `posts/**/*.md`)
- **Index page**: Choose your main page (becomes `index.html`)

### 4. GitHub Pages Configuration
1. **Push exported files**:
   ```bash
   git add .
   git commit -m "Initial site export"
   git push origin main
   ```

2. **Enable GitHub Pages**:
   - Go to repository Settings → Pages
   - Source: "Deploy from a branch"
   - Branch: `main` (or `master`)
   - Folder: `/ (root)`
   - Save

3. **Access your site**: `https://yourusername.github.io/your-vault-site`

### 5. Updating Your Site
```bash
# In Obsidian: run "Export vault to HTML"
# In terminal:
cd /path/to/your/repository
git add .
git commit -m "Update site content"
git push origin main
```

## Troubleshooting

**Images or videos not loading**: Open exported HTML files in a web browser, not in Obsidian. For local testing, use a simple HTTP server:
```bash
cd /path/to/export
python -m http.server 8000
# Open http://localhost:8000
```

**Broken links**: Ensure linked notes are included in your export patterns.

**GitHub Pages not updating**: Check repository Actions tab for build errors. Changes can take a few minutes to appear.

## Template Variables

- `{{note.title}}` - Note filename without extension
- `{{{note.content}}}` - Rendered HTML content (use triple braces for unescaped HTML)
- `{{note.frontmatter.property}}` - Access YAML frontmatter properties


## Credits

Based on the excellent [obsidian-sample-plugin](github.com/obsidianmd/obsidian-sample-plugin).
