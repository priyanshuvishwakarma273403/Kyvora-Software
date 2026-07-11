import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ITerminalService, ITerminalInstance } from '../../terminal/browser/terminal.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export class KyvoraAutoAutomation extends Disposable implements IWorkbenchContribution {
	private debounceTimer: any = null;
	private readonly installedLibs = new Set<string>();
	private readonly promptedErrors = new Set<string>();

	constructor(
		@IModelService private readonly modelService: IModelService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@ICommandService private readonly commandService: ICommandService
	) {
		super();
		this.registerModelListeners();
		this.registerTerminalListeners();
	}

	private registerModelListeners(): void {
		this._register(this.modelService.onModelAdded(model => {
			this.checkImports(model.getValue(), model.uri);
		}));

		this._register(this.modelService.onModelContentChanged(e => {
			const model = this.modelService.getModel(e.uri);
			if (model) {
				this.checkImports(model.getValue(), model.uri);
			}
		}));
	}

	private checkImports(content: string, uri: URI): void {
		if (!/\.(ts|tsx|js|jsx)$/.test(uri.path)) {
			return;
		}
		if (this.debounceTimer) {
			clearTimeout(this.debounceTimer);
		}
		this.debounceTimer = setTimeout(() => {
			this.scanImportsAndSuggest(content, uri);
		}, 3000);
	}

	private async scanImportsAndSuggest(content: string, uri: URI): Promise<void> {
		const importRegex = /import\s+[\s\S]*?\s+from\s+['"]([^'"]+)['"]|require\s*\(\s*['"]([^'"]+)['"]\s*\)/g;
		let match;
		const importedLibs = new Set<string>();
		while ((match = importRegex.exec(content)) !== null) {
			const lib = match[1] || match[2];
			if (lib && !lib.startsWith('.') && !lib.startsWith('/') && !lib.includes(':')) {
				const parts = lib.split('/');
				const pkgName = parts[0].startsWith('@') && parts.length > 1 ? `${parts[0]}/${parts[1]}` : parts[0];
				importedLibs.add(pkgName);
			}
		}

		if (importedLibs.size === 0) {
			return;
		}

		const folders = this.contextService.getWorkspace().folders;
		if (folders.length === 0) {
			return;
		}

		const packageJsonUri = URI.joinPath(folders[0].uri, 'package.json');
		try {
			const exists = await this.fileService.exists(packageJsonUri);
			if (!exists) {
				return;
			}
			const stat = await this.fileService.readFile(packageJsonUri);
			const pkg = JSON.parse(stat.value.toString());
			const deps = { ...pkg.dependencies, ...pkg.devDependencies };

			for (const lib of importedLibs) {
				const builtins = ['fs', 'path', 'os', 'child_process', 'crypto', 'http', 'https', 'stream', 'util', 'events', 'assert', 'dns', 'net', 'tls', 'querystring', 'url', 'zlib', 'buffer', 'readline'];
				if (builtins.includes(lib)) {
					continue;
				}

				if (!deps[lib]) {
					this.suggestInstallation(lib, folders[0].uri);
				}
			}
		} catch (e) {
			// ignore JSON error
		}
	}

	private suggestInstallation(lib: string, workspaceUri: URI): void {
		if (this.installedLibs.has(lib)) {
			return;
		}
		this.installedLibs.add(lib);

		this.notificationService.prompt(
			Severity.Info,
			`Import of "${lib}" is missing in package.json. Let Kyvora install it automatically?`,
			[
				{
					label: 'Install with npm',
					run: () => this.runInstallCommand(`npm install ${lib}`, workspaceUri)
				},
				{
					label: 'Install with yarn',
					run: () => this.runInstallCommand(`yarn add ${lib}`, workspaceUri)
				},
				{
					label: 'Ignore',
					run: () => {}
				}
			],
			{ sticky: true }
		);
	}

	private async runInstallCommand(command: string, workspaceUri: URI): Promise<void> {
		try {
			const instance = this.terminalService.activeInstance || await this.terminalService.createTerminal();
			if (instance) {
				await this.terminalService.revealActiveTerminal();
				instance.sendText(command, true);
			}
		} catch (e) {
			this.notificationService.error(`Failed to trigger installation: ${e}`);
		}
	}

	private registerTerminalListeners(): void {
		for (const instance of this.terminalService.instances) {
			this.hookTerminalInstance(instance);
		}
		this._register(this.terminalService.onDidCreateInstance(instance => {
			this.hookTerminalInstance(instance);
		}));
	}

	private hookTerminalInstance(instance: ITerminalInstance): void {
		this._register(instance.onLineData(line => {
			this.scanTerminalOutput(line, instance);
		}));
	}

	private scanTerminalOutput(line: string, instance: ITerminalInstance): void {
		// Clean line formatting
		const cleanLine = line.trim();
		if (!cleanLine) {
			return;
		}

		// 1. Check NPM Missing Dependency
		const npmMatch = /Cannot find module '([^']+)'|Can't resolve '([^']+)'/.exec(cleanLine);
		if (npmMatch) {
			const lib = npmMatch[1] || npmMatch[2];
			if (lib && !lib.startsWith('.') && !this.promptedErrors.has(lib)) {
				this.promptedErrors.add(lib);
				const folders = this.contextService.getWorkspace().folders;
				if (folders.length > 0) {
					this.suggestInstallation(lib, folders[0].uri);
				}
			}
			return;
		}

		// 2. Check Python Missing Dependency
		const pyMatch = /ModuleNotFoundError: No module named '([^']+)'|ImportError: No module named ([^'\s]+)/.exec(cleanLine);
		if (pyMatch) {
			const lib = pyMatch[1] || pyMatch[2];
			if (lib && !this.promptedErrors.has(lib)) {
				this.promptedErrors.add(lib);
				const folders = this.contextService.getWorkspace().folders;
				if (folders.length > 0) {
					this.notificationService.prompt(
						Severity.Info,
						`Python module "${lib}" is missing. Let Kyvora install it?`,
						[
							{
								label: 'Install with pip',
								run: () => this.runInstallCommand(`pip install ${lib}`, folders[0].uri)
							},
							{
								label: 'Ignore',
								run: () => {}
							}
						],
						{ sticky: true }
					);
				}
			}
			return;
		}

		// 3. Check General Reference/Syntax Error
		const errorMatch = /ReferenceError: ([^ ]+) is not defined|error TS\d+: (Cannot find name '[^']+'|[^\n]+)/.exec(cleanLine);
		if (errorMatch && !this.promptedErrors.has(cleanLine)) {
			this.promptedErrors.add(cleanLine);
			this.notificationService.prompt(
				Severity.Warning,
				`Terminal Error: "${cleanLine.slice(0, 80)}...". Autofix with Kyvora AI?`,
				[
					{
						label: 'Autofix Code',
						run: () => {
							this.commandService.executeCommand('workbench.action.chat.open', {
								query: `Fix the following terminal crash error:\n\n\`\`\`\n${cleanLine}\n\`\`\``
							});
						}
					},
					{
						label: 'Ignore',
						run: () => {}
					}
				],
				{ sticky: true }
			);
		}
	}
}
