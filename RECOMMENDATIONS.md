# Code Quality Recommendations

This document outlines opportunities to improve the Obsidian to HTML plugin codebase for better security, type safety, error handling, and future-proofing.

## 🔴 HIGH PRIORITY - Security Issues

### 1. Path Traversal Vulnerability (`src/services/html-export.ts:147`)

**Issue**: Direct concatenation of user input with file paths allows directory traversal attacks.

```typescript
// VULNERABLE
outputPath = join(this.settings.exportPath, customFileName);
```

**Risk**: Malicious input like `../../../etc/passwd` could write files outside intended directory.

**Fix**:
```typescript
import { resolve, normalize, relative } from 'path';

// Sanitize and validate paths
private sanitizePath(userPath: string, basePath: string): string {
    const normalized = normalize(userPath);
    const resolved = resolve(basePath, normalized);
    const relativePath = relative(basePath, resolved);

    if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
        throw new Error('Invalid path: directory traversal detected');
    }

    return resolved;
}
```

### 2. Unsafe Electron API Access (`src/utils/file-picker.ts:7-8`)

**Issue**: Direct access to `window.require` and electron APIs without proper validation.

```typescript
// UNSAFE
const electronWindow = window as Window & { require?: NodeRequire };
const electron = electronWindow.require?.('electron');
```

**Risk**: Potential code injection and privilege escalation.

**Fix**:
```typescript
// Use Obsidian's safe APIs instead
import { app } from 'electron';

export class FilePicker {
    static async selectFolder(): Promise<string | null> {
        // Use Obsidian's built-in dialog methods if available
        // Or implement proper electron context isolation
        if (!this.isElectronEnvironment()) {
            new Notice('File picker only available in desktop version');
            return null;
        }
        // ... safe implementation
    }

    private static isElectronEnvironment(): boolean {
        return typeof window !== 'undefined' &&
               window.process &&
               window.process.type === 'renderer';
    }
}
```

### 3. File Overwrite Protection (`src/services/html-export.ts:163`)

**Issue**: No protection against overwriting critical files.

```typescript
// UNSAFE
writeFileSync(outputPath, htmlContent, 'utf8');
```

**Fix**:
```typescript
// Check for critical system files
private async safeWriteFile(outputPath: string, content: string): Promise<void> {
    const criticalPaths = ['/etc/', '/usr/', '/System/', 'C:\\Windows\\'];

    if (criticalPaths.some(critical => outputPath.includes(critical))) {
        throw new Error('Cannot write to system directories');
    }

    // Check if file exists and is important
    if (existsSync(outputPath)) {
        const stats = statSync(outputPath);
        if (stats.isDirectory()) {
            throw new Error('Target is a directory');
        }
    }

    writeFileSync(outputPath, content, 'utf8');
}
```

## 🟡 MEDIUM PRIORITY - Type Safety

### 4. Replace `any` Types

**Issues**:
- `src/services/template-service.ts:8`: `Record<string, any>`
- `src/ui/settings-tab.ts:118`: `(this.plugin as any)`

**Fix**:
```typescript
// Define proper interfaces
interface FrontmatterData {
    title?: string;
    tags?: string[];
    date?: string;
    [key: string]: unknown; // For dynamic properties
}

interface NoteTemplateData {
    note: {
        title: string;
        content: string;
        frontmatter: FrontmatterData;
    };
}

// Remove unsafe casting
interface PluginWithTemplateMethod extends HtmlExportPlugin {
    createDefaultTemplate(): Promise<void>;
}

// Use type guard
private hasCreateDefaultTemplate(plugin: HtmlExportPlugin): plugin is PluginWithTemplateMethod {
    return typeof (plugin as any).createDefaultTemplate === 'function';
}
```

### 5. Add Null Checks and Type Guards

**Issues**:
- Missing null checks for file operations
- Unsafe type assertions

**Fix**:
```typescript
// Add proper type guards
private isValidTFile(file: TAbstractFile | null): file is TFile {
    return file instanceof TFile;
}

// Use in code
const templateFile = this.app.vault.getAbstractFileByPath(this.settings.templateNote);
if (!this.isValidTFile(templateFile)) {
    new Notice('Template note not found. Please select a valid template.');
    return;
}
```

### 6. Improve Error Type Handling

**Issue**: Unsafe error casting throughout codebase.

```typescript
// UNSAFE
} catch (error) {
    throw new Error(`Template rendering failed: ${(error as Error).message}`);
}
```

**Fix**:
```typescript
// Safe error handling
private getErrorMessage(error: unknown): string {
    if (error instanceof Error) {
        return error.message;
    }
    if (typeof error === 'string') {
        return error;
    }
    return 'Unknown error occurred';
}

// Usage
} catch (error) {
    throw new Error(`Template rendering failed: ${this.getErrorMessage(error)}`);
}
```

## 🟡 MEDIUM PRIORITY - Error Handling

### 7. Standardize Error Handling

**Issue**: Inconsistent error handling patterns across services.

**Fix**: Create centralized error handling:

```typescript
// src/utils/error-handler.ts
export class ErrorHandler {
    static handle(error: unknown, context: string, showUser = true): void {
        const message = this.getErrorMessage(error);
        const fullMessage = `${context}: ${message}`;

        // Log for debugging
        console.error(fullMessage, error);

        // Show user-friendly message
        if (showUser) {
            new Notice(`Error: ${message}`);
        }
    }

    static getErrorMessage(error: unknown): string {
        if (error instanceof Error) return error.message;
        if (typeof error === 'string') return error;
        return 'An unexpected error occurred';
    }
}
```

### 8. Add Input Validation

**Issue**: No validation for settings and user input.

**Fix**:
```typescript
// src/utils/validators.ts
export class SettingsValidator {
    static validateExportPath(path: string): boolean {
        if (!path || path.trim().length === 0) {
            throw new Error('Export path cannot be empty');
        }

        if (!path.isAbsolute(path)) {
            throw new Error('Export path must be absolute');
        }

        return true;
    }

    static validateGlobPatterns(patterns: string): boolean {
        const lines = patterns.split('\n').filter(line => line.trim());

        for (const pattern of lines) {
            if (pattern.includes('..')) {
                throw new Error('Directory traversal patterns not allowed');
            }
        }

        return true;
    }
}
```

### 9. Remove Debug Code

**Issues**:
- `src/main.ts:60`: `console.error`
- `src/services/html-export.ts:207`: `console.log`

**Fix**: Use proper logging system:

```typescript
// src/utils/logger.ts
export class Logger {
    private static isDevelopment = process.env.NODE_ENV === 'development';

    static debug(message: string, data?: any): void {
        if (this.isDevelopment) {
            console.log(`[HTML Export Debug] ${message}`, data);
        }
    }

    static info(message: string): void {
        console.info(`[HTML Export] ${message}`);
    }

    static error(message: string, error?: any): void {
        console.error(`[HTML Export Error] ${message}`, error);
    }
}
```

## 🟢 LOW PRIORITY - Future-Proofing

### 10. Replace Deprecated Electron APIs

**Issue**: `electron.remote` is deprecated (`src/utils/file-picker.ts:14`).

**Fix**:
```typescript
// Use modern IPC pattern
const { ipcRenderer } = require('electron');

export class FilePicker {
    static async selectFolder(): Promise<string | null> {
        try {
            const result = await ipcRenderer.invoke('show-open-dialog', {
                properties: ['openDirectory', 'createDirectory'],
                title: 'Select Export Folder'
            });

            return result.canceled ? null : result.filePaths[0];
        } catch (error) {
            Logger.error('File picker failed', error);
            return null;
        }
    }
}
```

### 11. Add Plugin Lifecycle Management

**Issue**: No proper cleanup in `onunload()`.

**Fix**:
```typescript
// src/main.ts
export default class HtmlExportPlugin extends Plugin {
    private cleanupTasks: (() => void)[] = [];

    async onload() {
        // ... existing code

        // Register cleanup
        this.cleanupTasks.push(() => {
            this.exportService?.cleanup();
            this.templateService?.cleanup();
        });
    }

    onunload() {
        // Clean up resources
        this.cleanupTasks.forEach(cleanup => {
            try {
                cleanup();
            } catch (error) {
                Logger.error('Cleanup failed', error);
            }
        });

        this.cleanupTasks = [];
    }
}
```

### 12. Make File Types Configurable

**Issue**: Hard-coded image extensions (`src/services/link-resolver.ts:149`).

**Fix**:
```typescript
// src/types/settings.ts
export interface HtmlExportSettings {
    // ... existing settings
    supportedImageTypes: string[];
    supportedDocumentTypes: string[];
}

export const DEFAULT_SETTINGS: HtmlExportSettings = {
    // ... existing defaults
    supportedImageTypes: ['.png', '.jpg', '.jpeg', '.gif', '.svg', '.webp', '.avif'],
    supportedDocumentTypes: ['.md', '.txt'],
};

// Usage in LinkResolver
private isImageFile(file: TFile): boolean {
    const ext = file.extension.toLowerCase();
    return this.settings.supportedImageTypes.includes(`.${ext}`);
}
```

### 13. Add Async File Operations

**Issue**: Synchronous file operations block the main thread.

**Fix**:
```typescript
import { promises as fs } from 'fs';

// Replace synchronous operations
private async safeWriteFile(outputPath: string, content: string): Promise<void> {
    try {
        await fs.access(dirname(outputPath));
    } catch {
        await fs.mkdir(dirname(outputPath), { recursive: true });
    }

    await fs.writeFile(outputPath, content, 'utf8');
}

private async copyImageFile(source: ArrayBuffer, targetPath: string): Promise<void> {
    const buffer = Buffer.from(source);
    await fs.writeFile(targetPath, buffer);
}
```

## Implementation Priority

1. **Immediate** (Security): Fix path traversal and unsafe API access
2. **Next Sprint** (Type Safety): Replace `any` types and add proper interfaces
3. **Following Sprint** (Error Handling): Standardize error handling and validation
4. **Future** (Maintenance): Update deprecated APIs and add lifecycle management

## Testing Recommendations

1. **Security Tests**: Path traversal attempts, malicious input validation
2. **Type Tests**: Compile-time type checking, runtime type validation
3. **Error Tests**: Error boundary testing, invalid input handling
4. **Integration Tests**: Full export workflow with various vault configurations

## Dependencies to Consider

- Add `@types/node` for proper Node.js typing
- Consider `zod` for runtime type validation
- Add `path-browserify` for consistent path handling
- Consider `sanitize-filename` for safe filename generation