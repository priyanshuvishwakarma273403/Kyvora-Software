import { IWorkbenchContribution } from '../../../common/contributions.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ITerminalService, ITerminalInstance } from '../../terminal/browser/terminal.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { URI } from '../../../../base/common/uri.js';
import { IKyvoraCollaborationService } from '../../kyvoraCollaboration/common/kyvoraCollaborationService.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';

export class KyvoraAutoAutomation extends Disposable implements IWorkbenchContribution {
	private debounceTimer: any = null;
	private readonly installedLibs = new Set<string>();
	private readonly promptedErrors = new Set<string>();

	// Multiplayer AI & Sandbox states
	private lastMessageCount = 0;
	private sandboxActive = false;
	private sandboxIterations = 0;
	private sandboxTerminal: ITerminalInstance | null = null;
	private sandboxErrorAccumulator = '';

	constructor(
		@IModelService private readonly modelService: IModelService,
		@IWorkspaceContextService private readonly contextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@INotificationService private readonly notificationService: INotificationService,
		@ITerminalService private readonly terminalService: ITerminalService,
		@ICommandService private readonly commandService: ICommandService,
		@IKyvoraCollaborationService private readonly collaborationService: IKyvoraCollaborationService,
		@ILanguageFeaturesService private readonly languageFeaturesService: ILanguageFeaturesService,
		@IEditorService private readonly editorService: IEditorService,
		@IStorageService private readonly storageService: IStorageService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.registerModelListeners();
		this.registerTerminalListeners();
		this.registerCollaborationListeners();
		this.registerAstCompletionProvider();
		this.registerSandboxCommands();
	}

	private registerModelListeners(): void {
		for (const model of this.modelService.getModels()) {
			this.hookModel(model);
		}
		this._register(this.modelService.onModelAdded(model => {
			this.hookModel(model);
		}));
	}

	private hookModel(model: any): void {
		this._register(model.onDidChangeContent(() => {
			this.checkImports(model.getValue(), model.uri);
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

	// ==========================================
	// FEATURE 1: Multiplayer AI Pair-Programming
	// ==========================================
	private registerCollaborationListeners(): void {
		this._register(this.collaborationService.onDidMessagesChange(messages => {
			if (!messages || messages.length <= this.lastMessageCount) {
				this.lastMessageCount = messages ? messages.length : 0;
				return;
			}
			this.lastMessageCount = messages.length;
			const lastMsg = messages[messages.length - 1];
			if (lastMsg && lastMsg.sender !== 'Kyvora AI' && lastMsg.sender !== this.collaborationService.getUsername()) {
				if (lastMsg.text.includes('@ai')) {
					this.respondAsAiParticipant(lastMsg.text);
				}
			}
		}));
	}

	private async respondAsAiParticipant(messageText: string): Promise<void> {
		const query = messageText.replace(/@ai/g, '').trim();
		if (!query) {
			return;
		}

		try {
			const serverUrl = this.configurationService.getValue<string>('kyvora.collaboration.serverUrl') || 'http://localhost:8080';
			const cleanUrl = serverUrl.replace(/\/$/, '');
			const url = `${cleanUrl}/api/v1/ai/completion`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.storageService.get('kyvora.collaboration.token', 0) || ''}`
				},
				body: JSON.stringify({
					provider: 'groq',
					model: 'mixtral-8x7b-32768',
					prompt: `You are Kyvora AI, a real-time collaborative pair-programmer in a VS Code multi-user session. 
A user has sent you a message: "${query}". 
Respond directly, concisely, and provide code blocks where necessary. Keep it conversational like a team developer.`
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data && data.text) {
					if (query.toLowerCase().includes('refactor') || query.toLowerCase().includes('fix') || query.toLowerCase().includes('edit')) {
						const activeEditor = this.editorService.activeTextEditorControl;
						const model = activeEditor?.getModel();
						const activeFile = this.editorService.activeEditor?.resource?.path;
						if (model && activeFile) {
							// Send AI cursor movement to let team members see the AI typing
							this.collaborationService.sendCursorMove(1, 1, activeFile);
							setTimeout(() => {
								const codeBlockMatch = /```[\w]*\n([\s\S]*?)```/.exec(data.text);
								const patchContent = codeBlockMatch ? codeBlockMatch[1] : null;
								if (patchContent) {
									const range = (model as any).getFullModelRange();
									const text = patchContent;
									const changes = [{ range, text }];
									
									this.collaborationService.sendTextEdit(activeFile, changes);
									(model as any).pushEditOperations([], [{ range, text, forceMoveMarkers: true }], () => null);
									this.collaborationService.sendChatMessage(`[Kyvora AI]: I have applied the requested changes/refactoring to ${activeFile.split('/').pop()}`);
								}
							}, 1500);
						}
					}
					
					this.collaborationService.sendChatMessage(`[Kyvora AI]: ${data.text}`);
				}
			}
		} catch {
			this.collaborationService.sendChatMessage(`[Kyvora AI]: Sorry, I encountered an error communicating with the AI gateway.`);
		}
	}

	// ==========================================
	// FEATURE 2: AST-Guided Next-Edit Completion
	// ==========================================
	private registerAstCompletionProvider(): void {
		this._register(this.languageFeaturesService.completionProvider.register({ scheme: '*', pattern: '**/*' }, {
			_debugDisplayName: 'kyvoraAstCompletion',
			provideCompletionItems: (model, position) => {
				const lastLine = model.getLineContent(position.lineNumber);
				const lineTrim = lastLine.trim();

				const suggestions: any[] = [];

				// 1. Detect open function bracket (AST structure)
				if (lineTrim.endsWith('(')) {
					suggestions.push({
						label: 'AST: param list & block',
						kind: 4,
						insertText: 'params) {\n\t$0\n}',
						insertTextRules: 4,
						detail: 'Kyvora AST Completion',
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column
						}
					});
				}

				// 2. Detect "if" statement structure
				if (lineTrim === 'if') {
					suggestions.push({
						label: 'AST: if block',
						kind: 4,
						insertText: ' ($1) {\n\t$0\n}',
						insertTextRules: 4,
						detail: 'Kyvora AST Completion',
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column
						}
					});
				}

				// 3. Detect "class" definition structure
				if (lineTrim.startsWith('class ') && !lineTrim.includes('{')) {
					suggestions.push({
						label: 'AST: class body',
						kind: 4,
						insertText: ' {\n\tconstructor() {\n\t\t$0\n\t}\n}',
						insertTextRules: 4,
						detail: 'Kyvora AST Completion',
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column
						}
					});
				}

				// 4. Detect try-catch block structure
				if (lineTrim === 'try') {
					suggestions.push({
						label: 'AST: try-catch block',
						kind: 4,
						insertText: ' {\n\t$1\n} catch (error) {\n\t$0\n}',
						insertTextRules: 4,
						detail: 'Kyvora AST Completion',
						range: {
							startLineNumber: position.lineNumber,
							startColumn: position.column,
							endLineNumber: position.lineNumber,
							endColumn: position.column
						}
					});
				}

				return { suggestions };
			}
		}));
	}

	// ==========================================
	// FEATURE 3: Autonomous Testing Sandbox
	// ==========================================
	private registerSandboxCommands(): void {
		this._register(CommandsRegistry.registerCommand('kyvora.runAutonomousSandbox', async () => {
			if (this.sandboxActive) {
				this.notificationService.info('Autonomous Testing Sandbox is already running.');
				return;
			}
			this.sandboxActive = true;
			this.sandboxIterations = 0;
			this.sandboxErrorAccumulator = '';
			
			this.notificationService.notify({
				severity: Severity.Info,
				message: 'Starting Autonomous Testing Sandbox. Kyvora will run tests and patch bugs automatically.'
			});

			await this.runSandboxTestCycle();
		}));
	}

	private async runSandboxTestCycle(): Promise<void> {
		if (!this.sandboxActive) return;
		this.sandboxIterations++;
		if (this.sandboxIterations > 5) {
			this.notificationService.error('Autonomous Sandbox reached max iterations (5) without passing. Aborting.');
			this.sandboxActive = false;
			return;
		}

		this.sandboxErrorAccumulator = '';
		const folders = this.contextService.getWorkspace().folders;
		if (folders.length === 0) {
			this.sandboxActive = false;
			return;
		}

		let testCmd = 'npm test';
		try {
			const hasPyproject = await this.fileService.exists(URI.joinPath(folders[0].uri, 'pyproject.toml'));
			const hasRequirements = await this.fileService.exists(URI.joinPath(folders[0].uri, 'requirements.txt'));
			if (hasPyproject || hasRequirements) {
				testCmd = 'pytest';
			}
		} catch {
			// ignore
		}

		this.notificationService.info(`[Sandbox Cycle ${this.sandboxIterations}] Running tests: "${testCmd}"...`);

		let terminal = this.sandboxTerminal;
		if (!terminal || terminal.isDisposed) {
			terminal = await this.terminalService.createTerminal({ title: 'Kyvora Sandbox' });
			this.sandboxTerminal = terminal;
			this._register(terminal.onLineData(line => {
				if (this.sandboxActive) {
					this.sandboxErrorAccumulator += line + '\n';
				}
			}));
		}

		await this.terminalService.revealActiveTerminal();
		terminal.sendText(testCmd, true);

		setTimeout(async () => {
			await this.analyzeSandboxResults();
		}, 12000);
	}

	private async analyzeSandboxResults(): Promise<void> {
		if (!this.sandboxActive) return;

		const output = this.sandboxErrorAccumulator;
		const isFailed = /fail|error|exception|failed|crash|ts\d+/i.test(output);

		if (!isFailed) {
			this.notificationService.notify({
				severity: Severity.Info,
				message: 'All tests passed successfully! Autonomous Sandbox completed.'
			});
			this.sandboxActive = false;
			return;
		}

		this.notificationService.warn(`[Sandbox] Tests failed. Requesting AI patch...`);

		const activeEditor = this.editorService.activeTextEditorControl;
		const model = activeEditor?.getModel();
		const activeUri = this.editorService.activeEditor?.resource;

		if (!model || !activeUri) {
			this.notificationService.error('[Sandbox] No active editor found to apply patches. Aborting.');
			this.sandboxActive = false;
			return;
		}

		const fileContent = (model as any).getValue();
		const errorLog = output.slice(-2000);

		try {
			const serverUrl = this.configurationService.getValue<string>('kyvora.collaboration.serverUrl') || 'http://localhost:8080';
			const cleanUrl = serverUrl.replace(/\/$/, '');
			const url = `${cleanUrl}/api/v1/ai/completion`;

			const response = await fetch(url, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.storageService.get('kyvora.collaboration.token', 0) || ''}`
				},
				body: JSON.stringify({
					provider: 'groq',
					model: 'mixtral-8x7b-32768',
					prompt: `You are an Autonomous Bug-Fixing Sandbox Agent.
We ran tests and got errors. Below is the error trace and the current code of the active file.
Please fix all the bugs causing this crash and reply ONLY with the corrected code inside a single markdown block (i.e. \`\`\`...\`\`\`). Do not add explanations.

Error Logs:
${errorLog}

Active File Code:
${fileContent}`
				})
			});

			if (response.ok) {
				const data = await response.json();
				if (data && data.text) {
					const codeBlockMatch = /```[\w]*\n([\s\S]*?)```/.exec(data.text);
					const patchedCode = codeBlockMatch ? codeBlockMatch[1] : null;
					if (patchedCode && patchedCode.trim() !== '') {
						(model as any).setValue(patchedCode);
						this.notificationService.notify({
							severity: Severity.Info,
							message: `[Sandbox] AI patch successfully applied to ${activeUri.path.split('/').pop()}. Re-testing...`
						});

						setTimeout(() => {
							this.runSandboxTestCycle();
						}, 3000);
						return;
					}
				}
			}
		} catch (e) {
			this.notificationService.error(`[Sandbox] AI patch service failed: ${e}`);
		}

		this.sandboxActive = false;
	}
}
