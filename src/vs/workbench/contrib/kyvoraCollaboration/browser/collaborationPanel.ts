import { IKyvoraCollaborationService } from '../common/kyvoraCollaborationService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';


export class CollaborationPanel extends Disposable {
	public static readonly VIEW_ID = 'kyvora.collaborationView';

	private _webview: { postMessage(message: any): void } | null = null;
	private activeThreadId: string | null = null;

	constructor(
		@IKyvoraCollaborationService private readonly collabService: IKyvoraCollaborationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService,
		@IRequestService private readonly requestService: IRequestService,
		@IFileService private readonly fileService: IFileService,
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IEditorService private readonly editorService: IEditorService,
		@IConfigurationService private readonly configurationService: IConfigurationService
	) {
		super();
		this.registerListeners();
	}

	setWebview(webview: { postMessage(message: any): void }): void {
		this._webview = webview;
		this.syncState();
	}

	private syncState(): void {
		if (!this._webview) { return; }

		this._webview.postMessage({
			type: 'stateSync',
			data: {
				sessionId: this.collabService.getSessionId(),
				secretToken: this.collabService.getSecretToken(),
				participants: this.collabService.getParticipants(),
				messages: this.collabService.getMessages(),
				activities: this.collabService.getActivities(),
				username: this.collabService.getUsername(),
				voiceMuted: this.collabService.isVoiceMuted(),
				isLoggedIn: this.collabService.isLoggedIn()
			}
		});

		if (this.collabService.isLoggedIn()) {
			this.collabService.getRecentSessions().then(sessions => {
				this._webview?.postMessage({
					type: 'recentSessions',
					sessions
				});
			});
		}
	}

	private registerListeners(): void {
		this._register(this.collabService.onDidSessionChange((session) => {
			if (this._webview) {
				this._webview.postMessage({
					type: 'sessionChanged',
					sessionId: session ? session.id : null,
					secretToken: session ? session.secretToken : null
				});
				this.syncState();
			}
			this.telemetryService.publicLog('kyvora.collaboration.sessionChanged', {
				sessionId: session ? session.id : 'none'
			});
		}));

		this._register(this.collabService.onDidParticipantsChange((participants) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'participantsChanged', participants });
			}
		}));

		this._register(this.collabService.onDidMessagesChange((messages) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'messagesChanged', messages });
			}
		}));

		this._register(this.collabService.onDidActivityChange((activities) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'activitiesChanged', activities });
			}
		}));

		this._register(this.collabService.onDidSessionExpired(() => {
			if (this._webview) {
				this._webview.postMessage({
					type: 'sessionExpired',
					message: 'Your session has expired. Please sign out and log in again.'
				});
			}
		}));
	}

		public async handleMessage(message: any): Promise<void> {
		switch (message.command) {
			case 'login':
				const loginSuccess = await this.collabService.login(message.username, message.password);
				this._webview?.postMessage({ type: 'loginResult', success: loginSuccess });
				this.syncState();
				break;
			case 'loginGoogle':
				const googleSuccess = await this.collabService.loginWithGoogle(message.email);
				this._webview?.postMessage({ type: 'loginResult', success: googleSuccess });
				this.syncState();
				break;
			case 'loginGithub':
				const githubSuccess = await this.collabService.loginWithGithub(message.email);
				this._webview?.postMessage({ type: 'loginResult', success: githubSuccess });
				this.syncState();
				break;
			case 'signup':
				const signupSuccess = await this.collabService.signup(message.username, message.email, message.password);
				this._webview?.postMessage({ type: 'signupResult', success: signupSuccess });
				this.syncState();
				break;
			case 'logout':
				this.collabService.logout();
				this.syncState();
				break;
			case 'createSession':
				const newSession = await this.collabService.createSession(message.title);
				if (!newSession) {
					this._webview?.postMessage({ type: 'sessionError', message: 'Failed to create session. Please try again.' });
				} else {
					this._webview?.postMessage({ type: 'sessionSuccess', message: 'Session created successfully!' });
				}
				break;
			case 'joinSession':
				const joinRes = await this.collabService.joinSession(message.sessionId, message.secretToken);
				if (!joinRes) {
					this._webview?.postMessage({ type: 'sessionError', message: 'Connection failed. Verify Session ID & Secret Token.' });
				} else {
					this._webview?.postMessage({ type: 'sessionSuccess', message: 'Connected to collaboration session!' });
				}
				break;
			case 'leaveSession':
				this.collabService.leaveSession();
				break;
			case 'sendChatMessage':
				this.collabService.sendChatMessage(message.text);
				break;
			case 'toggleVoice':
				this.collabService.toggleVoice();
				break;
			case 'getRecentSessions':
				const sessions = await this.collabService.getRecentSessions();
				this._webview?.postMessage({ type: 'recentSessions', sessions });
				break;
			case 'requestStateSync':
				this.syncState();
				break;
			case 'askAi':
				await this.handleAiQuery(message.text, message.mode, message.agentId, message.provider, message.model);
				break;
			case 'resumeAiGraph':
				await this.handleResumeAiGraph(message.approved, message.feedback, message.provider, message.model);
				break;
		}
	}

	private async handleAiQuery(text: string, mode: string, agentId: string, provider: string, model: string): Promise<void> {
		try {
			this.postProgressUpdate('Analyzing your request...');

			const serverUrl = this.configurationService.getValue<string>('kyvora.collaboration.serverUrl') || 'http://localhost:8080';
			const cleanUrl = serverUrl.replace(/\/$/, '');

			let apiUrl = '';
			let payload: any = {};
			const threadId = 'thread_' + Date.now();

			if (mode === 'agent') {
				apiUrl = `${cleanUrl}/api/v1/ai/agent/run`;
				payload = {
					agentId: agentId || 'coding',
					prompt: text,
					provider: provider || 'gemini',
					model: model || 'gemini-1.5-pro',
					files: []
				};
			} else if (mode === 'graph') {
				this.activeThreadId = threadId;
				apiUrl = `${cleanUrl}/api/v1/ai/agent/graph/run`;
				payload = {
					threadId: threadId,
					prompt: text,
					provider: provider || 'gemini',
					model: model || 'gemini-1.5-pro'
				};
			} else {
				// Default chat
				apiUrl = `${cleanUrl}/api/v1/ai/completion`;
				
				const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
				const rootFolder = workspaceFolders[0];
				let workspaceInfo = 'No folder open.';
				if (rootFolder) {
					workspaceInfo = `Workspace Root: ${rootFolder.uri.fsPath}\n`;
					try {
						const children = await this.fileService.resolve(rootFolder.uri);
						if (children && children.children) {
							workspaceInfo += 'Files in workspace root:\n';
							for (const child of children.children) {
								workspaceInfo += ` - ${child.name} (${child.isDirectory ? 'directory' : 'file'})\n`;
							}
						}
					} catch (e) { }
				}
				const systemPrompt = `You are Kyvora AI, a highly advanced agentic coding assistant integrated in Kyvora Studio.
You must help the developer by writing complete, high-quality code and making filesystem edits.
IMPORTANT: You MUST NOT use any emojis in your response. Not a single emoji is allowed.

${rootFolder ? `Active Workspace Info:
${workspaceInfo}` : ''}

When you want to create a new file or write to an existing file, you MUST write your changes in one of the following XML-like formats:

To CREATE a new file:
<create_file path="path/to/file.ext">
complete file content here
</create_file>

To EDIT/REWRITE an existing file's content completely:
<write_file path="path/to/file.ext">
complete new content here
</write_file>

Always specify paths relative to the workspace root.
Please describe your thoughts first (without using emojis), then provide the file actions, and finally summarize what you did. Keep your response clean, professional, and precise.`;

				payload = {
					provider: provider || 'gemini',
					model: model || 'gemini-1.5-pro',
					prompt: `${systemPrompt}\n\nUser Question:\n${text}`
				};
			}

			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			const token = this.collabService.getJwtToken();
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const context = await this.requestService.request({
				type: 'POST',
				url: apiUrl,
				headers: headers,
				data: JSON.stringify(payload),
				callSite: 'kyvoraAiQuery'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200) {
				const errMsg = `Server returned status code ${context.res.statusCode}`;
				this.postAiResponse(`Sorry, I encountered an error communicating with the Kyvora AI backend: ${errMsg}`);
				return;
			}

			const data = await asJson<any>(context);

			if (mode === 'agent') {
				const finalResponse = data?.finalResponse || 'No response from Agent.';
				const steps = data?.steps || [];
				let formattedResponse = `🤖 **Agent Status: ${data?.status || 'COMPLETED'}**\n\n`;
				
				if (steps.length > 0) {
					formattedResponse += `**Execution Trace:**\n`;
					for (const step of steps) {
						formattedResponse += `* *Thought:* ${step.thought || 'None'}\n`;
						if (step.toolCalled && step.toolCalled !== 'None') {
							formattedResponse += `  *Called Tool:* \`${step.toolCalled}\` with args \`${JSON.stringify(step.arguments)}\`\n`;
						}
					}
					formattedResponse += `\n`;
				}
				
				formattedResponse += `**Final Answer:**\n${finalResponse}`;
				await this.processFileActions(finalResponse);
				this.postAiResponse(formattedResponse);

			} else if (mode === 'graph') {
				const thread = data?.threadId || threadId;
				const checkpoint = data?.checkpointId || '';
				const history = data?.executionHistory || [];
				const plan = data?.planSteps || [];
				
				let formattedResponse = `⛓️ **LangGraph Agent Loop initiated** (Thread: \`${thread}\`)\n\n`;
				
				if (plan.length > 0) {
					formattedResponse += `**Execution Plan Milestones:**\n`;
					for (let i = 0; i < plan.length; i++) {
						const isCurrent = i === (data?.currentStepIndex || 0);
						formattedResponse += `${isCurrent ? '👉' : '◽'} ${plan[i]}\n`;
					}
					formattedResponse += `\n`;
				}

				if (history.length > 0) {
					formattedResponse += `**Running Milestones Execution:**\n`;
					for (const step of history) {
						formattedResponse += `* **[${step.agentId || 'agent'}]**: ${step.thought || ''}\n`;
						if (step.toolCalled && step.toolCalled !== 'None') {
							formattedResponse += `  *Tool:* \`${step.toolCalled}\` -> Output size: ${step.toolOutput ? step.toolOutput.length : 0} chars\n`;
						}
					}
					formattedResponse += `\n`;
				}

				if (checkpoint === 'awaiting_approval') {
					formattedResponse += `⚠️ **Awaiting Human Checkpoint Gate approval to deploy changes.**\n`;
					this._webview?.postMessage({
						type: 'showApprovalGate',
						threadId: thread
					});
				} else {
					formattedResponse += `✨ **Cycle Completed**\n`;
				}

				await this.processWorkspaceFiles(data?.workspaceFiles);
				this.postAiResponse(formattedResponse);

			} else {
				const responseText = data?.text || 'No response from AI.';
				await this.processFileActions(responseText);
				this.postAiResponse(responseText);
			}

		} catch (e: any) {
			console.error('AI Query error:', e);
			this.postAiResponse(`Error: ${e.message || e}`);
		}
	}

	private async handleResumeAiGraph(approved: boolean, feedback: string, provider: string, model: string): Promise<void> {
		try {
			this.postProgressUpdate('Sending response to LangGraph...');

			const serverUrl = this.configurationService.getValue<string>('kyvora.collaboration.serverUrl') || 'http://localhost:8080';
			const cleanUrl = serverUrl.replace(/\/$/, '');
			const apiUrl = `${cleanUrl}/api/v1/ai/agent/graph/resume`;

			const threadId = this.activeThreadId || ('thread_' + Date.now());

			const headers: Record<string, string> = {
				'Content-Type': 'application/json'
			};
			const token = this.collabService.getJwtToken();
			if (token) {
				headers['Authorization'] = `Bearer ${token}`;
			}

			const context = await this.requestService.request({
				type: 'POST',
				url: apiUrl,
				headers: headers,
				data: JSON.stringify({
					threadId: threadId,
					approved: approved,
					feedback: feedback,
					provider: provider || 'gemini',
					model: model || 'gemini-1.5-pro'
				}),
				callSite: 'kyvoraAiResume'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200) {
				const errMsg = `Server returned status code ${context.res.statusCode}`;
				this.postAiResponse(`Sorry, I encountered an error communicating with the Kyvora AI backend: ${errMsg}`);
				return;
			}

			const data = await asJson<any>(context);
			const history = data?.executionHistory || [];
			const checkpoint = data?.checkpointId || '';

			let formattedResponse = `🔄 **LangGraph resumed** (Approved: ${approved})\n\n`;

			if (history.length > 0) {
				formattedResponse += `**Updated Execution Trace:**\n`;
				for (const step of history) {
					formattedResponse += `* **[${step.agentId || 'agent'}]**: ${step.thought || ''}\n`;
				}
				formattedResponse += `\n`;
			}

			if (checkpoint === 'awaiting_approval') {
				formattedResponse += `⚠️ **Awaiting Human Checkpoint Gate approval to deploy changes.**\n`;
				this._webview?.postMessage({
					type: 'showApprovalGate',
					threadId: data?.threadId || threadId
				});
			} else {
				formattedResponse += `🎉 **LangGraph Loop completed successfully!**\n`;
			}

			await this.processWorkspaceFiles(data?.workspaceFiles);
			this.postAiResponse(formattedResponse);

		} catch (e: any) {
			console.error('AI Resume error:', e);
			this.postAiResponse(`Error resuming graph: ${e.message || e}`);
		}
	}

	private postProgressUpdate(text: string): void {
		this._webview?.postMessage({
			type: 'aiProgressUpdate',
			text
		});
	}

	private postAiResponse(text: string): void {
		this._webview?.postMessage({
			type: 'aiResponse',
			text
		});
	}
	private async processWorkspaceFiles(workspaceFiles: Record<string, any>): Promise<void> {
		if (!workspaceFiles) {
			return;
		}
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		const rootFolder = workspaceFolders[0];
		if (!rootFolder) {
			return;
		}

		for (const key of Object.keys(workspaceFiles)) {
			const fileInfo = workspaceFiles[key];
			const relPath = fileInfo.path || key;
			const content = fileInfo.content;
			if (content === undefined || content === null) {
				continue;
			}
			this.postProgressUpdate(`Updating workspace file: ${relPath}`);
			try {
				const fileUri = URI.joinPath(rootFolder.uri, relPath);
				let exists = false;
				try {
					exists = await this.fileService.exists(fileUri);
				} catch (err) {}

				if (!exists) {
					await this.fileService.createFile(fileUri, VSBuffer.fromString(content), { overwrite: true });
				} else {
					await this.fileService.writeFile(fileUri, VSBuffer.fromString(content));
				}
				await this.editorService.openEditor({ resource: fileUri });
			} catch (e) {
				console.error(`Failed to update workspace file ${relPath}:`, e);
			}
		}
	}

	private async processFileActions(text: string): Promise<void> {
		const workspaceFolders = this.workspaceContextService.getWorkspace().folders;
		const rootFolder = workspaceFolders[0];
		if (!rootFolder) {
			return;
		}

		const createFileRegex = /<create_file\s+path="([^"]+)">([\s\S]*?)<\/create_file>/g;
		const writeFileRegex = /<write_file\s+path="([^"]+)">([\s\S]*?)<\/write_file>/g;

		let match;
		while ((match = createFileRegex.exec(text)) !== null) {
			const relPath = match[1];
			const content = match[2];
			this.postProgressUpdate(`Creating file: ${relPath}`);
			try {
				const fileUri = URI.joinPath(rootFolder.uri, relPath);
				await this.fileService.createFile(fileUri, VSBuffer.fromString(content), { overwrite: true });
				await this.editorService.openEditor({ resource: fileUri });
			} catch (e) {
				console.error(`Failed to create file ${relPath}:`, e);
			}
		}

		while ((match = writeFileRegex.exec(text)) !== null) {
			const relPath = match[1];
			const content = match[2];
			this.postProgressUpdate(`Writing to file: ${relPath}`);
			try {
				const fileUri = URI.joinPath(rootFolder.uri, relPath);
				await this.fileService.writeFile(fileUri, VSBuffer.fromString(content));
				await this.editorService.openEditor({ resource: fileUri });
			} catch (e) {
				console.error(`Failed to write to file ${relPath}:`, e);
			}
		}
	}

	getHtmlContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Kyvora Collaboration Hub</title>
	<style>
		:root {
			--bg-deepest: #070709;
			--bg-panel: #0d0d12;
			--bg-card: #13131a;
			--bg-hover: #1c1c24;
			--bg-accent: #1e1333;
			--border-subtle: #191924;
			--border-accent: #2e204c;
			--accent-primary: #8B5CF6;
			--accent-secondary: #D946EF;
			--accent-bright: #c8b4f0;
			--accent-glow: rgba(139, 92, 246, 0.15);
			--text-primary: #e2e1e6;
			--text-secondary: #9a98a0;
			--text-muted: #5a5961;
			--text-very-muted: #3c3c42;
			--green: #10B981;
			--orange: #F59E0B;
			--red: #EF4444;
			--blue: #3B82F6;
		}

		* { box-sizing: border-box; margin: 0; padding: 0; }

		body {
			background-color: var(--bg-deepest);
			color: var(--text-primary);
			font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
			font-size: 13px;
			line-height: 1.4;
			overflow-x: hidden;
			display: flex;
			flex-direction: column;
			height: 100vh;
		}

		.header {
			padding: 16px;
			border-bottom: 1px solid var(--border-subtle);
			background: var(--bg-panel);
			display: flex;
			align-items: center;
			justify-content: space-between;
		}

		.header-title {
			font-size: 14px;
			font-weight: 600;
			color: var(--accent-bright);
			letter-spacing: 0.5px;
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.profile-section {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.username-label {
			color: var(--text-secondary);
			font-size: 11px;
			font-weight: 500;
		}

		.btn-logout {
			background: transparent;
			border: 1px solid var(--border-subtle);
			color: var(--text-secondary);
			padding: 2px 6px;
			border-radius: 4px;
			font-size: 10px;
			cursor: pointer;
			transition: all 0.2s;
		}

		.btn-logout:hover {
			color: var(--red);
			border-color: var(--red);
		}

		/* Tabs Navigation */
		.tabs {
			display: flex;
			border-bottom: 1px solid var(--border-subtle);
			background: var(--bg-panel);
		}

		.tab-btn {
			flex: 1;
			background: none;
			border: none;
			color: var(--text-secondary);
			padding: 10px 4px;
			font-size: 11px;
			font-weight: 500;
			cursor: pointer;
			text-align: center;
			transition: all 0.2s;
			border-bottom: 2px solid transparent;
		}

		.tab-btn:hover {
			color: var(--text-primary);
			background: var(--bg-hover);
		}

		.tab-btn.active {
			color: var(--accent-bright);
			border-bottom-color: var(--accent-primary);
		}

		/* Panels */
		.panel-content {
			flex: 1;
			overflow-y: auto;
			padding: 16px;
		}

		.tab-panel {
			display: none;
			flex-direction: column;
			gap: 16px;
			height: 100%;
		}

		.tab-panel.active {
			display: flex;
		}

		/* Cards & Elements */
		.card {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 14px;
			display: flex;
			flex-direction: column;
			gap: 12px;
		}

		.card-title {
			font-size: 12px;
			font-weight: 600;
			color: var(--text-secondary);
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		.input-group {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		label {
			font-size: 11px;
			color: var(--text-secondary);
		}

		input[type="text"], input[type="password"], input[type="email"] {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			padding: 8px 10px;
			border-radius: 6px;
			font-size: 12px;
			transition: all 0.2s;
		}

		input[type="text"]:focus, input[type="password"]:focus, input[type="email"]:focus {
			border-color: var(--accent-primary);
			box-shadow: 0 0 0 2px var(--accent-glow);
			outline: none;
		}

		.btn {
			background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
			color: white;
			border: none;
			padding: 10px 14px;
			border-radius: 6px;
			font-weight: 600;
			cursor: pointer;
			text-align: center;
			transition: all 0.2s;
			font-size: 12px;
		}

		.btn:hover {
			opacity: 0.9;
			transform: translateY(-1px);
		}

		.btn-secondary {
			background: var(--bg-hover);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
		}

		.btn-social {
			display: flex;
			align-items: center;
			justify-content: center;
			gap: 8px;
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			padding: 8px 12px;
			border-radius: 6px;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s;
			font-size: 12px;
			width: 100%;
			margin-top: 8px;
		}

		.btn-social:hover {
			border-color: var(--accent-primary);
			background: var(--bg-hover);
		}

		.btn-danger {
			background: var(--red);
		}

		/* Presence list */
		.participant-item {
			display: flex;
			align-items: center;
			justify-content: space-between;
			padding: 8px;
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
		}

		.participant-info {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		.participant-name {
			font-weight: 600;
			color: var(--text-primary);
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.status-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--green);
		}

		.participant-meta {
			font-size: 11px;
			color: var(--text-secondary);
		}

		.participant-actions {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		/* Chat tab */
		.chat-container {
			display: flex;
			flex-direction: column;
			height: 100%;
		}

		.chat-messages {
			flex: 1;
			overflow-y: auto;
			display: flex;
			flex-direction: column;
			gap: 10px;
			padding-bottom: 16px;
			max-height: calc(100vh - 240px);
		}

		.chat-bubble {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			padding: 8px 12px;
			border-radius: 8px;
			max-width: 90%;
			align-self: flex-start;
		}

		.chat-bubble.self {
			background: var(--accent-glow);
			border-color: var(--accent-primary);
			align-self: flex-end;
		}

		.chat-bubble.assistant {
			background: var(--bg-hover);
			border-color: var(--border-accent);
			align-self: flex-start;
		}

		@keyframes spin {
			to { transform: rotate(360deg); }
		}

		.chat-sender {
			font-weight: 600;
			font-size: 11px;
			color: var(--accent-bright);
			margin-bottom: 2px;
		}

		.chat-text {
			font-size: 12px;
		}

		.chat-time {
			font-size: 9px;
			color: var(--text-muted);
			text-align: right;
			margin-top: 4px;
		}

		.chat-input-container {
			display: flex;
			gap: 8px;
		}

		.chat-input {
			flex: 1;
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			padding: 8px 12px;
			border-radius: 6px;
			font-size: 12px;
		}

		.chat-suggestions {
			display: flex;
			flex-wrap: wrap;
			gap: 6px;
			margin-top: 8px;
			margin-bottom: 4px;
		}

		.suggestion-btn {
			background: var(--bg-hover);
			border: 1px solid var(--border-accent);
			color: var(--accent-bright);
			padding: 4px 10px;
			border-radius: 12px;
			font-size: 11px;
			cursor: pointer;
			transition: all 0.2s ease;
		}

		.suggestion-btn:hover {
			background: var(--accent-primary);
			color: #fff;
			border-color: var(--accent-primary);
			box-shadow: 0 0 8px var(--accent-glow);
		}

		/* Activity list */
		.activity-list {
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.activity-item {
			padding: 8px;
			border-radius: 6px;
			background: var(--bg-card);
			border-left: 3px solid var(--accent-primary);
			font-size: 11px;
			display: flex;
			justify-content: space-between;
		}

		.activity-time {
			color: var(--text-muted);
		}

		/* Authentication styling */
		.auth-container {
			display: flex;
			flex-direction: column;
			justify-content: flex-start;
			align-items: center;
			height: 100%;
			width: 100%;
			padding: 16px;
			background: var(--bg-deepest);
			overflow-y: auto;
		}

		.auth-card {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			padding: 24px;
			border-radius: 12px;
			width: 100%;
			max-width: 320px;
			display: flex;
			flex-direction: column;
			gap: 16px;
			box-shadow: 0 8px 32px rgba(0,0,0,0.5);
		}

		.auth-title {
			font-size: 18px;
			font-weight: 700;
			color: var(--accent-bright);
			text-align: center;
			margin-bottom: 8px;
		}

		.auth-toggle-link {
			color: var(--accent-primary);
			font-size: 12px;
			cursor: pointer;
			text-align: center;
			margin-top: 8px;
		}

		.auth-alert {
			padding: 10px 12px;
			border-radius: 6px;
			font-size: 12px;
			margin-bottom: 12px;
			width: 100%;
			max-width: 320px;
			text-align: center;
			display: none;
			animation: fadeIn 0.2s ease;
		}
		.auth-alert.success {
			background-color: rgba(16, 185, 129, 0.15);
			border: 1px solid var(--green);
			color: #34d399;
		}
		.auth-alert.error {
			background-color: rgba(239, 68, 68, 0.15);
			border: 1px solid var(--red);
			color: #f87171;
		}

		/* AI Config Panel */
		.ai-config-bar {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 8px 12px;
			display: flex;
			flex-direction: column;
			gap: 8px;
			margin-bottom: 8px;
			width: 100%;
		}
		.ai-config-row {
			display: flex;
			gap: 8px;
			width: 100%;
		}
		.ai-config-item {
			flex: 1;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}
		.ai-config-item label {
			font-size: 9px;
			text-transform: uppercase;
			color: var(--text-secondary);
			font-weight: 600;
		}
		.ai-config-item select {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			padding: 4px 6px;
			border-radius: 4px;
			font-size: 11px;
			outline: none;
		}
		.ai-config-item select:focus {
			border-color: var(--accent-primary);
		}

		/* Approval Gate Overlay */
		.approval-overlay {
			position: absolute;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background: rgba(7, 7, 9, 0.85);
			backdrop-filter: blur(8px);
			display: flex;
			align-items: center;
			justify-content: center;
			padding: 16px;
			z-index: 100;
			animation: fadeIn 0.3s ease;
		}
		.approval-card {
			background: var(--bg-card);
			border: 1px solid var(--border-accent);
			border-radius: 12px;
			padding: 18px;
			display: flex;
			flex-direction: column;
			align-items: center;
			gap: 12px;
			width: 100%;
			box-shadow: 0 10px 25px rgba(0,0,0,0.5);
		}
		.approval-icon {
			color: var(--orange);
			background: rgba(245, 158, 11, 0.1);
			padding: 10px;
			border-radius: 50%;
			display: flex;
			align-items: center;
			justify-content: center;
		}
		.approval-title {
			font-size: 13px;
			font-weight: 700;
			color: var(--accent-bright);
		}
		.approval-desc {
			font-size: 11px;
			color: var(--text-secondary);
			text-align: center;
			line-height: 1.4;
		}
		.approval-card textarea {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			padding: 6px 10px;
			border-radius: 6px;
			font-size: 11px;
			width: 100%;
			height: 60px;
			resize: none;
			outline: none;
		}
		.approval-card textarea:focus {
			border-color: var(--accent-primary);
		}
		.approval-actions {
			display: flex;
			gap: 8px;
			width: 100%;
		}
		.approval-actions button {
			flex: 1;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(-5px); }
			to { opacity: 1; transform: translateY(0); }
		}
	</style>
</head>
<body>
	<!-- Authentication Wrapper -->
	<div id="authView" class="auth-container" style="display: none;">
		<div id="authAlert" class="auth-alert"></div>
		<!-- Login Card -->
		<div id="loginCard" class="auth-card">
			<div class="auth-title">Sign In to Kyvora</div>
			<div class="input-group">
				<label>Username / Email</label>
				<input type="text" id="loginUsername" placeholder="Enter username or email" />
			</div>
			<div class="input-group">
				<label>Password</label>
				<input type="password" id="loginPassword" placeholder="Enter password" />
			</div>
			<button class="btn" onclick="submitLogin()">Sign In</button>

			<div style="display: flex; align-items: center; justify-content: center; gap: 8px; margin: 4px 0; color: var(--text-muted); font-size: 11px;">
				<span style="flex: 1; height: 1px; background: var(--border-subtle);"></span>
				OR
				<span style="flex: 1; height: 1px; background: var(--border-subtle);"></span>
			</div>

			<button class="btn-social" onclick="submitGoogleLogin()">
				<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" fill="#FBBC05"/>
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" fill="#EA4335"/>
				</svg>
				Continue with Google
			</button>
			<button class="btn-social" onclick="submitGithubLogin()">
				<svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
				</svg>
				Continue with GitHub
			</button>
			<div class="auth-toggle-link" onclick="toggleAuth(true)" style="margin-top: 8px;">Need an account? Sign Up</div>
		</div>

		<!-- Signup Card -->
		<div id="signupCard" class="auth-card" style="display: none;">
			<div class="auth-title">Create Account</div>
			<div class="input-group">
				<label>Username</label>
				<input type="text" id="signupUsername" placeholder="Choose username" />
			</div>
			<div class="input-group">
				<label>Email</label>
				<input type="email" id="signupEmail" placeholder="Enter email" />
			</div>
			<div class="input-group">
				<label>Password</label>
				<input type="password" id="signupPassword" placeholder="Choose password" />
			</div>
			<button class="btn" onclick="submitSignup()">Sign Up</button>
			<div class="auth-toggle-link" onclick="toggleAuth(false)">Have an account? Sign In</div>
		</div>
	</div>

	<!-- Main Hub Workspace -->
	<div id="mainHubView" style="display: flex; flex-direction: column; height: 100%;">
		<div id="mainAlert" class="auth-alert" style="margin: 8px 16px 0 16px; max-width: calc(100% - 32px);"></div>
		<div class="header">
			<div class="header-title">
				<svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
					<path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82.64-.18 1.32-.27 2-.27.68 0 1.36.09 2 .27 1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.013 8.013 0 0016 8c0-4.42-3.58-8-8-8z"/>
				</svg>
				Kyvora Collaboration
			</div>
			<div class="profile-section">
				<span id="headerUsername" class="username-label"></span>
				<button class="btn-logout" onclick="triggerLogout()">Sign Out</button>
			</div>
		</div>

		<div class="tabs">
			<button class="tab-btn active" onclick="switchTab('sessions')">Sessions</button>
			<button class="tab-btn" onclick="switchTab('presence')">Participants</button>
			<button class="tab-btn" onclick="switchTab('chat')">Live Chat</button>
			<button class="tab-btn" onclick="switchTab('ai')">Kyvora AI</button>
			<button class="tab-btn" onclick="switchTab('activity')">Activity</button>
		</div>

		<div class="panel-content" style="position: relative; height: calc(100% - 90px); display: flex; flex-direction: column;">
			<!-- Sessions Tab -->
			<div id="sessions-tab" class="tab-panel active">
				<div id="no-session-view" class="card">
					<div class="card-title">Start a Session</div>
					<div class="input-group">
						<label for="sessionTitle">Session Title</label>
						<input type="text" id="sessionTitle" placeholder="e.g. Code Review with Team" />
					</div>
					<button class="btn" onclick="createSession()">Launch Session</button>

					<div style="text-align: center; color: var(--text-muted); font-size: 11px;">OR</div>

					<div class="card-title">Join Live Session</div>
					<div class="input-group">
						<label for="joinId">Session ID</label>
						<input type="text" id="joinId" placeholder="Enter 8-char code (e.g. A3F9D2E8)" />
					</div>
					<div class="input-group">
						<label for="joinToken">Secret Token</label>
						<input type="password" id="joinToken" placeholder="Enter session token" />
					</div>
					<button class="btn btn-secondary" onclick="joinSession()">Connect to Room</button>
				</div>

				<div id="active-session-view" class="card" style="display: none;">
					<div class="card-title">Active Workspace</div>
					<div class="input-group">
						<label>Session ID</label>
						<input type="text" id="activeSessionId" readonly />
					</div>
					<div class="input-group">
						<label>Secret Token</label>
						<input type="password" id="activeSecretToken" readonly />
					</div>
					<button class="btn btn-secondary" onclick="copyInviteInfo()">Copy Invite Link</button>
					<button class="btn btn-danger" onclick="leaveSession()">Disconnect Session</button>
				</div>

				<div class="card">
					<div class="card-title">Recent Session Rooms</div>
					<div id="recentSessionsList" style="display: flex; flex-direction: column; gap: 8px;">
						<!-- Loaded dynamically -->
					</div>
				</div>
			</div>

			<!-- Presence Tab -->
			<div id="presence-tab" class="tab-panel">
				<div class="card">
					<div class="card-title">Voice Communication</div>
					<button id="voiceBtn" class="btn btn-secondary" onclick="toggleVoice()">Mute Microphone</button>
				</div>
				<div class="card">
					<div class="card-title">Active Programmers</div>
					<div id="participantsList" style="display: flex; flex-direction: column; gap: 8px;">
						<!-- Loaded dynamically -->
					</div>
				</div>
			</div>

			<!-- Chat Tab -->
			<div id="chat-tab" class="tab-panel chat-container">
				<div class="chat-messages" id="chatMessages">
					<!-- Loaded dynamically -->
				</div>
				<div class="chat-input-container">
					<input type="text" id="chatInput" class="chat-input" placeholder="Type a message..." onkeydown="if(event.key === 'Enter') sendChatMessage()" />
					<button class="btn" onclick="sendChatMessage()">Send</button>
				</div>
			</div>

			<!-- Kyvora AI Tab -->
			<div id="ai-tab" class="tab-panel chat-container" style="position: relative; height: 100%;">
				<div class="ai-config-bar">
					<div class="ai-config-row">
						<div class="ai-config-item">
							<label>Mode</label>
							<select id="aiMode" onchange="toggleAiModeFields()">
								<option value="graph" selected>LangGraph Loop</option>
								<option value="chat">Direct Chat</option>
								<option value="agent">Single Agent</option>
							</select>
						</div>
						<div class="ai-config-item" id="aiAgentGroup" style="display: none;">
							<label>Agent</label>
							<select id="aiAgent">
								<option value="planner">Planner</option>
								<option value="research">Researcher</option>
								<option value="context">Context</option>
								<option value="memory">Memory</option>
								<option value="file">File</option>
								<option value="coding" selected>Coding</option>
								<option value="refactor">Refactor</option>
								<option value="debug">Debugger</option>
								<option value="testing">Testing</option>
							</select>
						</div>
					</div>
					<div class="ai-config-row">
						<div class="ai-config-item">
							<label>LLM Provider</label>
							<select id="aiProvider">
								<option value="gemini">Gemini</option>
								<option value="groq">Groq</option>
								<option value="openrouter">OpenRouter</option>
								<option value="huggingface">HuggingFace</option>
								<option value="sambanova">SambaNova</option>
							</select>
						</div>
						<div class="ai-config-item">
							<label>Model</label>
							<select id="aiModel">
								<option value="gemini-1.5-pro">gemini-1.5-pro</option>
								<option value="gemini-1.5-flash">gemini-1.5-flash</option>
								<option value="llama-3.1-70b">llama-3.1-70b</option>
								<option value="claude-3-5-sonnet">claude-3-5-sonnet</option>
							</select>
						</div>
					</div>
				</div>

				<div class="chat-messages" id="aiMessages" style="flex: 1; max-height: calc(100vh - 350px);">
					<div class="chat-bubble assistant">
						<div class="chat-sender">Kyvora AI</div>
						<div class="chat-text">Hello! I am Kyvora AI, your autonomous programming assistant. I can write code, create files, and fix errors in your workspace. How can I help you today?</div>
					</div>
				</div>

				<div id="aiProgress" style="display: none; padding: 8px; color: var(--accent-bright); font-size: 11px; text-align: center;">
					<span class="spinner" style="display: inline-block; width: 12px; height: 12px; border: 2px solid var(--accent-primary); border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite; margin-right: 6px; vertical-align: middle;"></span>
					<span id="aiProgressText">Processing request...</span>
				</div>

				<div class="chat-input-container">
					<input type="text" id="aiInput" class="chat-input" placeholder="Ask Kyvora AI..." onkeydown="if(event.key === 'Enter') sendAiMessage()" />
					<button class="btn" onclick="sendAiMessage()">Ask</button>
				</div>

				<!-- Human Approval Gate Overlay -->
				<div id="approvalOverlay" class="approval-overlay" style="display: none;">
					<div class="approval-card">
						<div class="approval-icon">
							<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
								<path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"/>
								<line x1="12" y1="9" x2="12" y2="13"/>
								<line x1="12" y1="17" x2="12.01" y2="17"/>
							</svg>
						</div>
						<div class="approval-title">Human Checkpoint Reached</div>
						<div class="approval-desc">The LangGraph loop is paused. Review the proposed modifications and choose whether to proceed or request a rework.</div>
						
						<div class="input-group" style="width: 100%;">
							<label>Rework Feedback (Optional)</label>
							<textarea id="approvalFeedback" placeholder="What should the agent change? e.g. Add unit test assertions..."></textarea>
						</div>
						
						<div class="approval-actions">
							<button class="btn btn-secondary" onclick="respondToApproval(false)">Rework</button>
							<button class="btn" style="background: linear-gradient(135deg, #10B981, #059669);" onclick="respondToApproval(true)">Approve & Deploy</button>
						</div>
					</div>
				</div>
			</div>

			<!-- Activity Tab -->
			<div id="activity-tab" class="tab-panel">
				<div class="card">
					<div class="card-title">Live Log</div>
					<div class="activity-list" id="activityList">
						<!-- Loaded dynamically -->
					</div>
				</div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let state = {};

		// Tab switching
		function switchTab(tabId) {
			document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
			document.querySelectorAll('.tab-panel').forEach(panel => panel.classList.remove('active'));
			
			// Find button dynamically
			let activeBtn = null;
			if (window.event) {
				const target = window.event.currentTarget || window.event.target;
				if (target && target.classList.contains('tab-btn')) {
					activeBtn = target;
				}
			}
			if (!activeBtn) {
				const buttons = document.querySelectorAll('.tab-btn');
				for (const b of buttons) {
					if (b.getAttribute('onclick')?.includes(tabId)) {
						activeBtn = b;
						break;
					}
				}
			}
			if (activeBtn) {
				activeBtn.classList.add('active');
			}
			document.getElementById(tabId + '-tab').classList.add('active');
		}

		// Alert display helpers
		let authAlertTimeout = null;
		function showAlert(message, isSuccess) {
			const alertDiv = document.getElementById('authAlert');
			alertDiv.textContent = message;
			alertDiv.className = 'auth-alert ' + (isSuccess ? 'success' : 'error');
			alertDiv.style.display = 'block';
			
			if (authAlertTimeout) { clearTimeout(authAlertTimeout); }
			authAlertTimeout = setTimeout(() => {
				alertDiv.style.display = 'none';
			}, 5000);
		}

		let mainAlertTimeout = null;
		function showMainAlert(message, isSuccess) {
			const alertDiv = document.getElementById('mainAlert');
			alertDiv.textContent = message;
			alertDiv.className = 'auth-alert ' + (isSuccess ? 'success' : 'error');
			alertDiv.style.display = 'block';
			
			if (mainAlertTimeout) { clearTimeout(mainAlertTimeout); }
			mainAlertTimeout = setTimeout(() => {
				alertDiv.style.display = 'none';
			}, 5000);
		}

		// Auth view toggling
		function toggleAuth(showSignup) {
			document.getElementById('loginCard').style.display = showSignup ? 'none' : 'flex';
			document.getElementById('signupCard').style.display = showSignup ? 'flex' : 'none';
		}

		function submitLogin() {
			const u = document.getElementById('loginUsername').value.trim();
			const p = document.getElementById('loginPassword').value.trim();
			if (!u || !p) {
				showAlert('Username and password are required!', false);
				return;
			}
			vscode.postMessage({ command: 'login', username: u, password: p });
		}

		function submitGoogleLogin() {
			const emailInput = document.getElementById('loginUsername');
			const email = emailInput.value.trim();
			if (!email) {
				showAlert('Please enter your email in the Username field first!', false);
				emailInput.focus();
				return;
			}
			vscode.postMessage({ command: 'loginGoogle', email: email });
		}

		function submitGithubLogin() {
			const emailInput = document.getElementById('loginUsername');
			const email = emailInput.value.trim();
			if (!email) {
				showAlert('Please enter your email in the Username field first!', false);
				emailInput.focus();
				return;
			}
			vscode.postMessage({ command: 'loginGithub', email: email });
		}

		function submitSignup() {
			const u = document.getElementById('signupUsername').value.trim();
			const e = document.getElementById('signupEmail').value.trim();
			const p = document.getElementById('signupPassword').value.trim();
			if (!u || !e || !p) {
				showAlert('All fields (username, email, password) are required!', false);
				return;
			}
			vscode.postMessage({ command: 'signup', username: u, email: e, password: p });
		}

		function triggerLogout() {
			vscode.postMessage({ command: 'logout' });
		}

		function toggleAiModeFields() {
			const mode = document.getElementById('aiMode').value;
			document.getElementById('aiAgentGroup').style.display = (mode === 'agent') ? 'flex' : 'none';
		}

		function respondToApproval(approved) {
			const feedback = document.getElementById('approvalFeedback').value.trim();
			submitApproval(approved, feedback);
			document.getElementById('approvalFeedback').value = '';
		}

		function submitApproval(approved, feedback) {
			document.getElementById('approvalOverlay').style.display = 'none';
			document.getElementById('aiProgress').style.display = 'block';
			document.getElementById('aiProgressText').textContent = approved ? 'Deploying changes...' : 'Routing feedback...';

			const provider = document.getElementById('aiProvider').value;
			const model = document.getElementById('aiModel').value;

			vscode.postMessage({
				command: 'resumeAiGraph',
				approved: approved,
				feedback: feedback,
				provider: provider,
				model: model
			});
		}

		window.addEventListener('message', event => {
			const msg = event.data;
			switch (msg.type) {
				case 'stateSync':
					state = msg.data;
					updateUI();
					break;
				case 'participantsChanged':
					state.participants = msg.participants;
					renderParticipants();
					break;
				case 'messagesChanged':
					state.messages = msg.messages;
					renderMessages();
					break;
				case 'activitiesChanged':
					state.activities = msg.activities;
					renderActivities();
					break;
				case 'recentSessions':
					renderRecentSessions(msg.sessions);
					break;
				case 'loginResult':
					if (!msg.success) {
						showAlert('Authentication failed. Please verify credentials.', false);
					} else {
						showMainAlert('Successfully logged in!', true);
					}
					break;
				case 'signupResult':
					if (msg.success) {
						showAlert('Account created! You can now log in.', true);
						setTimeout(() => toggleAuth(false), 2000);
					} else {
						showAlert('Signup failed. Username or email may already be registered.', false);
					}
					break;
				case 'aiResponse':
					document.getElementById('aiProgress').style.display = 'none';
					renderAiMessage('Kyvora AI', msg.text, false);
					break;
				case 'aiProgressUpdate':
					document.getElementById('aiProgressText').textContent = msg.text;
					break;
				case 'showApprovalGate':
					document.getElementById('approvalOverlay').style.display = 'flex';
					state.activeThreadId = msg.threadId;
					break;
				case 'sessionError':
					showMainAlert(msg.message, false);
					break;
				case 'sessionSuccess':
					showMainAlert(msg.message, true);
					break;
				case 'sessionExpired':
					showAlert(msg.message, false);
					break;
			}
		});

		function updateUI() {
			if (!state.isLoggedIn) {
				document.getElementById('authView').style.display = 'flex';
				document.getElementById('mainHubView').style.display = 'none';
				return;
			}

			document.getElementById('authView').style.display = 'none';
			document.getElementById('mainHubView').style.display = 'flex';

			document.getElementById('headerUsername').textContent = 'Hello, ' + state.username;

			if (state.sessionId) {
				document.getElementById('no-session-view').style.display = 'none';
				document.getElementById('active-session-view').style.display = 'flex';
				document.getElementById('activeSessionId').value = state.sessionId;
				document.getElementById('activeSecretToken').value = state.secretToken;
			} else {
				document.getElementById('no-session-view').style.display = 'flex';
				document.getElementById('active-session-view').style.display = 'none';
			}

			const voiceBtn = document.getElementById('voiceBtn');
			if (state.voiceMuted) {
				voiceBtn.textContent = 'Unmute Microphone';
				voiceBtn.className = 'btn btn-secondary';
			} else {
				voiceBtn.textContent = 'Mute Microphone';
				voiceBtn.className = 'btn';
			}

			renderParticipants();
			renderMessages();
			renderActivities();
		}

		function createSession() {
			const title = document.getElementById('sessionTitle').value.trim() || 'Collaboration Session';
			vscode.postMessage({ command: 'createSession', title });
		}

		function joinSession() {
			const sessionId = document.getElementById('joinId').value.trim();
			const secretToken = document.getElementById('joinToken').value.trim();
			if (!sessionId || !secretToken) {
				showMainAlert('Session ID and Secret Token are required!', false);
				return;
			}
			vscode.postMessage({ command: 'joinSession', sessionId, secretToken });
		}

		function leaveSession() {
			vscode.postMessage({ command: 'leaveSession' });
		}

		function copyInviteInfo() {
			const sid = document.getElementById('activeSessionId').value;
			const token = document.getElementById('activeSecretToken').value;
			const info = \`Session ID: \${sid}\\nSecret Token: \${token}\`;
			navigator.clipboard.writeText(info);
			alert('Session details copied to clipboard!');
		}

		function toggleVoice() {
			vscode.postMessage({ command: 'toggleVoice' });
		}

		function sendChatMessage() {
			const input = document.getElementById('chatInput');
			const text = input.value.trim();
			if (text) {
				vscode.postMessage({ command: 'sendChatMessage', text });
				input.value = '';
			}
		}

		function renderParticipants() {
			const list = document.getElementById('participantsList');
			list.innerHTML = '';
			if (!state.participants || state.participants.length === 0) {
				list.innerHTML = '<div style="color: var(--text-muted)">No active participants</div>';
				return;
			}
			state.participants.forEach(p => {
				const item = document.createElement('div');
				item.className = 'participant-item';
				item.innerHTML = \`
					<div class="participant-info">
						<div class="participant-name">
							<span class="status-dot"></span>
							\${p.username}
						</div>
						<div class="participant-meta">
							Editing: \${p.activeFile || 'Idle'} (Line \${p.cursorLine || 1})
						</div>
					</div>
					<div class="participant-actions">
						<span style="font-size: 10px; color: var(--text-muted)">\${p.voiceMuted ? 'Muted' : 'Mic Active'}</span>
					</div>
				\`;
				list.appendChild(item);
			});
		}

		function sendSuggestion(text) {
			vscode.postMessage({ command: 'sendChatMessage', text });
		}

		// Renders live chat messages
		function renderMessages() {
			const list = document.getElementById('chatMessages');
			list.innerHTML = '';
			if (!state.messages || state.messages.length === 0) {
				list.innerHTML = '<div style="color: var(--text-muted); text-align: center; padding-top: 20px;">No messages yet</div>';
				return;
			}
			state.messages.forEach(m => {
				const bubble = document.createElement('div');
				const isSelf = m.sender === state.username;
				bubble.className = 'chat-bubble' + (isSelf ? ' self' : '');
				
				let text = m.text;
				let suggestionsContainer = null;
				const match = text.match(/\[SUGGESTIONS\]([\s\S]*?)\[\/SUGGESTIONS\]/);
				if (match) {
					text = text.replace(match[0], '').trim();
					const suggestions = match[1].split('\n').map(s => s.trim()).filter(s => s.length > 0);
					if (suggestions.length > 0) {
						suggestionsContainer = document.createElement('div');
						suggestionsContainer.className = 'chat-suggestions';
						suggestions.forEach(s => {
							const btn = document.createElement('button');
							btn.className = 'suggestion-btn';
							btn.textContent = s;
							btn.onclick = () => sendSuggestion(s);
							suggestionsContainer.appendChild(btn);
						});
					}
				}

				const senderDiv = document.createElement('div');
				senderDiv.className = 'chat-sender';
				senderDiv.textContent = m.sender;
				bubble.appendChild(senderDiv);

				const textDiv = document.createElement('div');
				textDiv.className = 'chat-text';
				
				let imageUrl = null;
				let cleanText = text;
				if (text.includes('[IMAGE_DATA_URL:')) {
					const match = text.match(/\[IMAGE_DATA_URL:\s*([^\]]+)\s*\]/);
					if (match && match[1]) {
						imageUrl = match[1].replace(/\s/g, "");
						cleanText = text.replace(/\[IMAGE_DATA_URL:\s*([^\]]+)\s*\]/g, "");
					}
				}

				textDiv.textContent = cleanText;
				bubble.appendChild(textDiv);

				if (imageUrl) {
					const imgDiv = document.createElement('div');
					imgDiv.style.marginTop = '8px';
					imgDiv.style.maxWidth = '100%';
					imgDiv.style.border = '1px solid var(--border-subtle)';
					imgDiv.style.borderRadius = '4px';
					imgDiv.style.overflow = 'hidden';
					imgDiv.style.background = 'var(--bg-deepest)';
					imgDiv.style.padding = '4px';
					imgDiv.style.display = 'flex';
					imgDiv.style.justifyContent = 'center';

					const img = document.createElement('img');
					img.src = imageUrl;
					img.alt = 'Shared Image';
					img.style.maxHeight = '200px';
					img.style.maxWidth = '100%';
					img.style.objectFit = 'contain';
					img.style.borderRadius = '2px';

					imgDiv.appendChild(img);
					bubble.appendChild(imgDiv);
				}

				if (suggestionsContainer) {
					bubble.appendChild(suggestionsContainer);
				}

				const timeDiv = document.createElement('div');
				timeDiv.className = 'chat-time';
				timeDiv.textContent = m.time;
				bubble.appendChild(timeDiv);

				list.appendChild(bubble);
			});
			list.scrollTop = list.scrollHeight;
		}

		function renderActivities() {
			const list = document.getElementById('activityList');
			list.innerHTML = '';
			if (!state.activities || state.activities.length === 0) {
				list.innerHTML = '<div style="color: var(--text-muted)">No activity log</div>';
				return;
			}
			state.activities.forEach(a => {
				const item = document.createElement('div');
				item.className = 'activity-item';
				item.innerHTML = \`
					<span>\${a.text}</span>
					<span class="activity-time">\${a.time}</span>
				\`;
				list.appendChild(item);
			});
		}

		function renderRecentSessions(sessions) {
			const list = document.getElementById('recentSessionsList');
			list.innerHTML = '';
			if (!sessions || sessions.length === 0) {
				list.innerHTML = '<div style="color: var(--text-muted)">No recent sessions</div>';
				return;
			}
			sessions.forEach(s => {
				const item = document.createElement('div');
				item.className = 'participant-item';
				item.style.cursor = 'pointer';
				item.onclick = () => {
					document.getElementById('joinId').value = s.id;
					document.getElementById('joinToken').value = s.secretToken;
					switchTab('sessions');
				};
				item.innerHTML = \`
					<div class="participant-info">
						<div class="participant-name">\${s.title}</div>
						<div class="participant-meta">Room: \${s.id}</div>
					</div>
				\`;
				list.appendChild(item);
			});
		}

		function sendAiMessage() {
			const input = document.getElementById('aiInput');
			const text = input.value.trim();
			if (!text) return;

			renderAiMessage(state.username || 'User', text, true);
			input.value = '';

			document.getElementById('aiProgress').style.display = 'block';
			document.getElementById('aiProgressText').textContent = 'Analyzing request...';

			const mode = document.getElementById('aiMode').value;
			const agentId = document.getElementById('aiAgent').value;
			const provider = document.getElementById('aiProvider').value;
			const model = document.getElementById('aiModel').value;

			vscode.postMessage({ 
				command: 'askAi', 
				text: text, 
				mode: mode, 
				agentId: agentId, 
				provider: provider, 
				model: model 
			});
		}

		function renderAiMessage(sender, text, isSelf) {
			const list = document.getElementById('aiMessages');
			const bubble = document.createElement('div');
			bubble.className = 'chat-bubble' + (isSelf ? ' self' : ' assistant');

			const senderDiv = document.createElement('div');
			senderDiv.className = 'chat-sender';
			senderDiv.textContent = sender;
			bubble.appendChild(senderDiv);

			const textDiv = document.createElement('div');
			textDiv.className = 'chat-text';
			
			let imageUrl = null;
			let cleanText = text;
			if (text.includes('[IMAGE_DATA_URL:')) {
				const match = text.match(/\[IMAGE_DATA_URL:\s*([^\]]+)\s*\]/);
				if (match && match[1]) {
					imageUrl = match[1].replace(/\s/g, "");
					cleanText = text.replace(/\[IMAGE_DATA_URL:\s*([^\]]+)\s*\]/g, "");
				}
			}

			let formattedText = cleanText
				.replace(/&/g, "&amp;")
				.replace(/</g, "&lt;")
				.replace(/>/g, "&gt;");
			
			formattedText = formattedText.replace(/\`\`\`([\s\S]*?)\`\`\`/g, (match, code) => {
				return '<pre style="background: var(--bg-deepest); padding: 8px; border-radius: 4px; overflow-x: auto; margin-top: 6px; font-family: monospace; font-size: 11px; border: 1px solid var(--border-subtle);">' + code.trim() + '</pre>';
			});

			textDiv.innerHTML = formattedText;
			bubble.appendChild(textDiv);

			if (imageUrl) {
				const imgDiv = document.createElement('div');
				imgDiv.style.marginTop = '8px';
				imgDiv.style.maxWidth = '100%';
				imgDiv.style.border = '1px solid var(--border-subtle)';
				imgDiv.style.borderRadius = '4px';
				imgDiv.style.overflow = 'hidden';
				imgDiv.style.background = 'var(--bg-deepest)';
				imgDiv.style.padding = '4px';
				imgDiv.style.display = 'flex';
				imgDiv.style.justifyContent = 'center';

				const img = document.createElement('img');
				img.src = imageUrl;
				img.alt = 'Agent Generated Image';
				img.style.maxHeight = '200px';
				img.style.maxWidth = '100%';
				img.style.objectFit = 'contain';
				img.style.borderRadius = '2px';

				imgDiv.appendChild(img);
				bubble.appendChild(imgDiv);
			}

			const timeDiv = document.createElement('div');
			timeDiv.className = 'chat-time';
			const now = new Date();
			timeDiv.textContent = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
			bubble.appendChild(timeDiv);

			list.appendChild(bubble);
			list.scrollTop = list.scrollHeight;
		}

		// Initial request for recent rooms and state sync
		vscode.postMessage({ command: 'getRecentSessions' });
		vscode.postMessage({ command: 'requestStateSync' });
	</script>
</body>
</html>`;
	}
}
