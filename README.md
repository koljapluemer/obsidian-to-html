# Obsidian to HTML

Export your Obsidian vault to static HTML files with full image support and link resolution.

## Features

- Export selected notes using glob patterns
- Convert `![[image.jpg]]` to proper HTML with width support (`![[image.jpg|400]]`)
- Convert `[[note links]]` to relative HTML links
- Copy only referenced images to output
- Customizable HTML templates using Handlebars
- GitHub Pages ready output

## Installation

1. Download the latest release files: `main.js`, `manifest.json`, `styles.css`
2. Create folder: `VaultFolder/.obsidian/plugins/obsidian-to-html/`
3. Copy files to that folder
4. Restart Obsidian and enable the plugin

## Usage

1. **Create template**: Run command "Add default template note" or create your own HTML template with `{{note.title}}` and `{{{note.content}}}` placeholders
2. **Configure export**:
   - Set export path (e.g., `/Users/you/Sites/my-vault`)
   - Select template note
   - Set include patterns (e.g., `posts/**/*.md`, `public/**/*.md`)
   - Optionally set index page
3. **Export**: Run command "Export vault to HTML"

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

### 3. Template Setup
Your HTML template should include:
```html
<!DOCTYPE html>
<html>
<head>
    <title>{{note.title}}</title>
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/water.css@2/out/light.css">
</head>
<body>
    <h1>{{note.title}}</h1>
    {{{note.content}}}
</body>
</html>
```

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

## File Structure
```
export-folder/
├── index.html          # Your index page
├── assets/             # Images and media
│   ├── image1.png
│   └── diagram.svg
├── posts/              # Exported notes (maintaining folder structure)
│   ├── my-post.html
│   └── another-post.html
└── projects/
    └── project-notes.html
```

## Troubleshooting

**Images not loading**: Open exported HTML files in a web browser, not in Obsidian. For local testing, use a simple HTTP server:
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