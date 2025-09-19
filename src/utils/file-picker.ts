import { Notice } from 'obsidian';

export class FilePicker {
	static async selectFolder(): Promise<string | null> {
		try {
			// Use Electron's dialog API for folder selection (desktop-only)
			const electronWindow = window as Window & { require?: NodeRequire };
			const electron = electronWindow.require?.('electron');
			if (!electron) {
				new Notice('File picker not available in this environment');
				return null;
			}

			const { dialog } = electron.remote || electron;
			const result = await dialog.showOpenDialog({
				properties: ['openDirectory', 'createDirectory'],
				title: 'Select Export Folder'
			});

			if (!result.canceled && result.filePaths.length > 0) {
				return result.filePaths[0];
			}

			return null;
		} catch (error) {
			new Notice('File picker not available: ' + (error as Error).message);
			return null;
		}
	}
}