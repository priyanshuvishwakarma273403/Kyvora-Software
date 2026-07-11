import { ViewPane } from '../../../browser/parts/views/viewPane.js';
import { IViewletViewOptions } from '../../../browser/parts/views/viewsViewlet.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IContextKeyService } from '../../../../platform/contextkey/common/contextkey.js';
import { IContextMenuService } from '../../../../platform/contextview/browser/contextView.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IViewDescriptorService } from '../../../common/views.js';
import { IHoverService } from '../../../../platform/hover/browser/hover.js';
import { IWebviewService, IWebviewElement } from '../../webview/browser/webview.js';
import { getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { AdvancedPanel } from './advancedPanel.js';

export class KyvoraAdvancedView extends ViewPane {
	private webview: IWebviewElement | undefined;
	private advancedPanel: AdvancedPanel | undefined;
	private container: HTMLElement | undefined;
	private readonly webviewDisposables = this._register(new DisposableStore());

	constructor(
		options: IViewletViewOptions,
		@IKeybindingService keybindingService: IKeybindingService,
		@IContextMenuService contextMenuService: IContextMenuService,
		@IConfigurationService configurationService: IConfigurationService,
		@IContextKeyService contextKeyService: IContextKeyService,
		@IViewDescriptorService viewDescriptorService: IViewDescriptorService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IOpenerService openerService: IOpenerService,
		@IThemeService themeService: IThemeService,
		@IHoverService hoverService: IHoverService,
		@IWebviewService private readonly webviewService: IWebviewService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IEditorService private readonly editorService: IEditorService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
		
		this._register(this.onDidChangeBodyVisibility(visible => {
			if (visible) {
				this.buildWebview();
			} else {
				this.webviewDisposables.clear();
				this.webview = undefined;
			}
		}));
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		this.container = container;
		this.container.style.width = '100%';
		this.container.style.height = '100%';
		this.container.style.display = 'flex';
		this.container.style.flexDirection = 'column';

		this.advancedPanel = this._register(this.instantiationService.createInstance(AdvancedPanel));
		this.buildWebview();
	}

	private buildWebview(): void {
		this.webviewDisposables.clear();

		if (!this.container || !this.advancedPanel) {
			return;
		}

		this.webview = this.webviewDisposables.add(this.webviewService.createWebviewElement({
			title: 'Kyvora Advanced Hub',
			options: { purpose: undefined },
			contentOptions: { allowScripts: true },
			extension: undefined
		}));

		this.webview.mountTo(this.container, getWindow(this.container));

		this.webviewDisposables.add(this.webview.onMessage(async e => {
			await this.handleWebviewMessage(e.message);
		}));

		this.webview.setHtml(this.advancedPanel.getHtmlContent());
	}

	private async handleWebviewMessage(message: any): Promise<void> {
		switch (message.command) {
			case 'getWorkspaceFiles': {
				const files = await this.getWorkspaceFilesList();
				this.webview?.postMessage({ command: 'workspaceFilesData', files });
				break;
			}
			case 'openFile': {
				const relativePath = message.path;
				const folders = this.contextService.getWorkspace().folders;
				if (folders.length > 0) {
					const fileUri = URI.joinPath(folders[0].uri, relativePath);
					await this.editorService.openEditor({
						resource: fileUri,
						options: { pinned: true }
					});
				}
				break;
			}
			case 'voiceCommand': {
				await this.handleVoiceCommand(message.action, message.value);
				break;
			}
			case 'createSandboxFile': {
				await this.createFileInWorkspace(message.name, message.content);
				break;
			}
		}
	}

	private async getWorkspaceFilesList(): Promise<{ name: string; path: string }[]> {
		const folders = this.contextService.getWorkspace().folders;
		const files: { name: string; path: string }[] = [];
		for (const folder of folders) {
			await this.collectFiles(folder.uri, files, folder.uri);
		}
		return files.slice(0, 100); // Limit to 100 files for visuals
	}

	private async collectFiles(dirUri: URI, result: { name: string; path: string }[], rootUri: URI): Promise<void> {
		try {
			const stat = await this.fileService.resolve(dirUri);
			if (stat.children) {
				for (const child of stat.children) {
					if (child.isDirectory) {
						if (!child.name.startsWith('.') && child.name !== 'node_modules' && child.name !== 'out' && child.name !== 'dist' && child.name !== 'build') {
							await this.collectFiles(child.resource, result, rootUri);
						}
					} else {
						if (/\.(ts|tsx|js|jsx|json|java|py|css|html|md|rs|go|sh)$/.test(child.name)) {
							const relativePath = child.resource.path.substring(rootUri.path.length + 1);
							result.push({
								name: child.name,
								path: relativePath
							});
						}
					}
				}
			}
		} catch (e) {
			// ignore
		}
	}

	private async handleVoiceCommand(action: string, value: string): Promise<void> {
		try {
			if (action === 'search') {
				await this.commandService.executeCommand('workbench.action.findInFiles', { query: value });
			} else if (action === 'open') {
				const files = await this.getWorkspaceFilesList();
				const match = files.find(f => f.name.toLowerCase().includes(value.toLowerCase()));
				if (match) {
					const folders = this.contextService.getWorkspace().folders;
					const fileUri = URI.joinPath(folders[0].uri, match.path);
					await this.editorService.openEditor({ resource: fileUri, options: { pinned: true } });
				}
			} else if (action === 'create') {
				await this.createFileInWorkspace(value, '// Created via VocalCode voice command\n');
			} else if (action === 'closeAll') {
				await this.commandService.executeCommand('workbench.action.closeAllEditors');
			} else if (action === 'theme') {
				await this.commandService.executeCommand('workbench.action.selectTheme');
			} else if (action === 'explain') {
				const activeEditor = this.editorService.activeTextEditorControl;
				const selection = activeEditor?.getSelection();
				const model = activeEditor?.getModel();
				if (model && selection) {
					const text = model.getValueInRange(selection);
					await this.commandService.executeCommand('workbench.action.chat.open', {
						query: `Explain the following code snippet:\n\n\`\`\`\n${text}\n\`\`\``
					});
				}
			}
		} catch (e) {
			// ignore
		}
	}

	private async createFileInWorkspace(name: string, content: string): Promise<void> {
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length > 0) {
			const fileUri = URI.joinPath(folders[0].uri, name);
			await this.fileService.createFile(fileUri, VSBuffer.fromString(content), { overwrite: true });
			await this.editorService.openEditor({ resource: fileUri, options: { pinned: true } });
		}
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
	}
}
