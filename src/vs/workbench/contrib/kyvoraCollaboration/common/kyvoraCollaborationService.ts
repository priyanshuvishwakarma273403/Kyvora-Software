import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable, DisposableStore } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { ICodeEditorService } from '../../../../editor/browser/services/codeEditorService.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { IRequestService, asJson } from '../../../../platform/request/common/request.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { Range } from '../../../../editor/common/core/range.js';

export const IKyvoraCollaborationService = createDecorator<IKyvoraCollaborationService>('kyvoraCollaborationService');

export interface IKyvoraCollaborationService {
	readonly _serviceBrand: undefined;

	// Events
	readonly onDidSessionChange: Event<any>;
	readonly onDidParticipantsChange: Event<any[]>;
	readonly onDidMessagesChange: Event<any[]>;
	readonly onDidActivityChange: Event<any[]>;
	readonly onDidSessionExpired: Event<void>;

	// Methods
	getUsername(): string;
	getSessionId(): string | null;
	getSecretToken(): string | null;
	getJwtToken(): string | null;
	getParticipants(): any[];
	getMessages(): any[];
	getActivities(): any[];
	isVoiceMuted(): boolean;
	isLoggedIn(): boolean;

	login(username: string, password: string): Promise<boolean>;
	signup(username: string, email: string, password: string): Promise<boolean>;
	loginWithGoogle(email: string): Promise<boolean>;
	loginWithGithub(email: string): Promise<boolean>;
	logout(): void;

	createSession(title: string): Promise<any>;
	joinSession(sessionId: string, secretToken: string): Promise<any>;
	leaveSession(): void;
	sendChatMessage(text: string): void;
	sendCursorMove(line: number, col: number, activeFile: string): void;
	sendTextEdit(filePath: string, changes: any[]): void;
	sendTerminalInput(terminalId: string, text: string): void;
	toggleVoice(): void;
	getRecentSessions(): Promise<any[]>;
}

export class KyvoraCollaborationService extends Disposable implements IKyvoraCollaborationService {
	declare readonly _serviceBrand: undefined;

	private readonly _onDidSessionChange = this._register(new Emitter<any>());
	readonly onDidSessionChange: Event<any> = this._onDidSessionChange.event;

	private readonly _onDidParticipantsChange = this._register(new Emitter<any[]>());
	readonly onDidParticipantsChange: Event<any[]> = this._onDidParticipantsChange.event;

	private readonly _onDidMessagesChange = this._register(new Emitter<any[]>());
	readonly onDidMessagesChange: Event<any[]> = this._onDidMessagesChange.event;

	private readonly _onDidActivityChange = this._register(new Emitter<any[]>());
	readonly onDidActivityChange: Event<any[]> = this._onDidActivityChange.event;

	private readonly _onDidSessionExpired = this._register(new Emitter<void>());
	readonly onDidSessionExpired: Event<void> = this._onDidSessionExpired.event;

	private sessionId: string | null = null;
	private secretToken: string | null = null;
	private participants: any[] = [];
	private messages: any[] = [];
	private activities: any[] = [];
	private voiceMuted = true;
	private isApplyingRemoteChange = false;

	private socket: WebSocket | null = null;
	private baseUrl = 'http://localhost:8080/api/v1';
	private wsUrl = 'ws://localhost:8080/ws-collaboration';
	private token: string | null = null;
	private username = '';
	private participantDecorations = new Map<string, { modelUri: string, decorationIds: string[] }>();

	constructor(
		@IStorageService private readonly storageService: IStorageService,
		@ICodeEditorService private readonly codeEditorService: ICodeEditorService,
		@IEditorService private readonly editorService: IEditorService,
		@INotificationService private readonly notificationService: INotificationService,
		@IConfigurationService private readonly configurationService: IConfigurationService,
		@IRequestService private readonly requestService: IRequestService
	) {
		super();
		this.initUrls();
		this.initUser();
		this.trackEditorChanges();
		this._register(this.configurationService.onDidChangeConfiguration(e => {
			if (e.affectsConfiguration('kyvora.collaboration.serverUrl')) {
				this.initUrls();
			}
		}));
	}

	private initUrls(): void {
		const serverUrl = this.configurationService.getValue<string>('kyvora.collaboration.serverUrl') || 'http://localhost:8080';
		const cleanUrl = serverUrl.replace(/\/$/, '');
		this.baseUrl = `${cleanUrl}/api/v1`;
		const wsProto = cleanUrl.startsWith('https://') ? 'wss://' : 'ws://';
		const hostPort = cleanUrl.replace(/^https?:\/\//, '');
		this.wsUrl = `${wsProto}${hostPort}/ws-collaboration`;
	}

	private initUser(): void {
		this.username = this.storageService.get('kyvora.collaboration.username', StorageScope.APPLICATION) || '';
		this.token = this.storageService.get('kyvora.collaboration.token', StorageScope.APPLICATION) || null;
	}

	isLoggedIn(): boolean {
		return !!this.token;
	}

	async login(username: string, password: string): Promise<boolean> {
		try {
			const context = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}/auth/login`,
				headers: { 
					'Content-Type': 'application/json',
					'X-Client-Type': 'vscode'
				},
				data: JSON.stringify({ username, password }),
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200) {
				return false;
			}

			const data = await asJson<any>(context);
			if (data && data.token) {
				this.token = data.token;
				this.username = username;
				this.storageService.store('kyvora.collaboration.token', data.token, StorageScope.APPLICATION, StorageTarget.MACHINE);
				this.storageService.store('kyvora.collaboration.username', username, StorageScope.APPLICATION, StorageTarget.MACHINE);
				this._onDidSessionChange.fire(null); // Notify state sync
				return true;
			}
			return false;
		} catch (e) {
			console.error('Login error:', e);
			return false;
		}
	}

	async signup(username: string, email: string, password: string): Promise<boolean> {
		try {
			const context = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}/auth/signup`,
				headers: { 'Content-Type': 'application/json' },
				data: JSON.stringify({ username, email, password }),
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);

			return context.res.statusCode === 200;
		} catch (e) {
			console.error('Signup error:', e);
			return false;
		}
	}

	async loginWithGoogle(email: string): Promise<boolean> {
		try {
			const devToken = `dev-token-for-${email}`;
			const context = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}/auth/google`,
				headers: { 
					'Content-Type': 'application/json',
					'X-Client-Type': 'vscode'
				},
				data: JSON.stringify({ idToken: devToken }),
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200) {
				return false;
			}

			const data = await asJson<any>(context);
			if (data && data.token) {
				this.token = data.token;
				this.username = data.username || email.split('@')[0];
				this.storageService.store('kyvora.collaboration.token', data.token, StorageScope.APPLICATION, StorageTarget.MACHINE);
				this.storageService.store('kyvora.collaboration.username', this.username, StorageScope.APPLICATION, StorageTarget.MACHINE);
				this._onDidSessionChange.fire(null);
				return true;
			}
			return false;
		} catch (e) {
			console.error('Google login error:', e);
			return false;
		}
	}

	async loginWithGithub(email: string): Promise<boolean> {
		try {
			const devToken = `dev-token-for-${email}`;
			const context = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}/auth/github`,
				headers: { 
					'Content-Type': 'application/json',
					'X-Client-Type': 'vscode'
				},
				data: JSON.stringify({ code: devToken }),
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200) {
				return false;
			}

			const data = await asJson<any>(context);
			if (data && data.token) {
				this.token = data.token;
				this.username = data.username || email.split('@')[0];
				this.storageService.store('kyvora.collaboration.token', data.token, StorageScope.APPLICATION, StorageTarget.MACHINE);
				this.storageService.store('kyvora.collaboration.username', this.username, StorageScope.APPLICATION, StorageTarget.MACHINE);
				this._onDidSessionChange.fire(null);
				return true;
			}
			return false;
		} catch (e) {
			console.error('Github login error:', e);
			return false;
		}
	}

	logout(): void {
		this.leaveSession();
		this.token = null;
		this.username = '';
		this.storageService.remove('kyvora.collaboration.token', StorageScope.APPLICATION);
		this.storageService.remove('kyvora.collaboration.username', StorageScope.APPLICATION);
		this._onDidSessionChange.fire(null);
	}

	private trackEditorChanges(): void {
		// Register for existing editors
		for (const editor of this.codeEditorService.listCodeEditors()) {
			this.registerEditorListeners(editor);
		}

		// Register for new editors as they are created
		this._register(this.codeEditorService.onCodeEditorAdd(editor => {
			this.registerEditorListeners(editor);
		}));
	}

	private registerEditorListeners(editor: any): void {
		const disposables = new DisposableStore();

		disposables.add(editor.onDidChangeCursorPosition((e: any) => {
			const active = this.editorService.activeEditor;
			if (active && this.sessionId) {
				const filePath = active.resource?.path || 'Untitled';
				this.sendCursorMove(e.position.lineNumber, e.position.column, filePath);
			}
		}));

		disposables.add(editor.onDidChangeModelContent((e: any) => {
			if (this.isApplyingRemoteChange) { return; }
			const model = editor.getModel();
			const active = this.editorService.activeEditor;
			if (model && active && this.sessionId) {
				const filePath = active.resource?.path || 'Untitled';
				this.sendTextEdit(filePath, e.changes);
			}
		}));

		disposables.add(editor.onDidDispose(() => {
			disposables.dispose();
		}));

		this._register(disposables);
	}

	getUsername(): string {
		return this.username;
	}

	getSessionId(): string | null {
		return this.sessionId;
	}

	getSecretToken(): string | null {
		return this.secretToken;
	}

	getJwtToken(): string | null {
		return this.token;
	}

	getParticipants(): any[] {
		return this.participants;
	}

	getMessages(): any[] {
		return this.messages;
	}

	getActivities(): any[] {
		return this.activities;
	}

	isVoiceMuted(): boolean {
		return this.voiceMuted;
	}

	async createSession(title: string): Promise<any> {
		if (!this.token) { return null; }
		try {
			const context = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}/sessions?title=${encodeURIComponent(title)}`,
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.token}`
				},
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200 && context.res.statusCode !== 201) {
				if (context.res.statusCode === 401) {
					this.logout();
					this._onDidSessionExpired.fire();
				}
				return null;
			}

			const session = await asJson<any>(context);
			if (session && session.id) {
				this.sessionId = session.id;
				this.secretToken = session.secretToken;
				this.connectWebSocket(session.id);
				this._onDidSessionChange.fire(session);
				this.logActivity(`Session "${title}" created`);
				return session;
			}
			return null;
		} catch (e) {
			console.error('Create session error:', e);
			return null;
		}
	}

	async joinSession(sessionId: string, secretToken: string): Promise<any> {
		if (!this.token) { return null; }
		try {
			const context = await this.requestService.request({
				type: 'POST',
				url: `${this.baseUrl}/sessions/${sessionId}/join?secretToken=${encodeURIComponent(secretToken)}`,
				headers: { 
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${this.token}`
				},
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);

			if (context.res.statusCode !== 200 && context.res.statusCode !== 201) {
				if (context.res.statusCode === 401) {
					this.logout();
					this._onDidSessionExpired.fire();
				}
				return null;
			}

			const participant = await asJson<any>(context);
			if (participant) {
				this.sessionId = sessionId;
				this.secretToken = secretToken;
				this.connectWebSocket(sessionId);
				this._onDidSessionChange.fire({ id: sessionId, secretToken });
				this.logActivity(`Joined session ${sessionId}`);
				return participant;
			}
			return null;
		} catch (e) {
			console.error('Join session error:', e);
			return null;
		}
	}

	leaveSession(): void {
		if (this.socket) {
			this.socket.close();
			this.socket = null;
		}
		if (this.sessionId) {
			this.logActivity(`Left session ${this.sessionId}`);
		}
		this.sessionId = null;
		this.secretToken = null;
		this.participants = [];
		this.messages = [];
		this.clearAllParticipantDecorations();
		this._onDidSessionChange.fire(null);
		this._onDidParticipantsChange.fire([]);
		this._onDidMessagesChange.fire([]);
	}

	private connectWebSocket(sessionId: string): void {
		if (this.socket) { this.socket.close(); }
		const wsUri = `${this.wsUrl}?token=${this.token}&sessionId=${sessionId}`;
		this.socket = new WebSocket(wsUri);

		this.socket.onmessage = (event) => {
			try {
				const data = JSON.parse(event.data);
				this.handleWebSocketEvent(data);
			} catch (e) {
				console.error('Error handling WebSocket message:', e);
			}
		};

		this.socket.onclose = () => {
			console.log('Collaboration socket closed');
		};
	}

	private handleWebSocketEvent(event: any): void {
		switch (event.type) {
			case 'USER_JOINED':
				const joinedPresence = JSON.parse(event.payload);
				if (!this.participants.some(p => p.userId === joinedPresence.userId)) {
					this.participants.push(joinedPresence);
					this._onDidParticipantsChange.fire([...this.participants]);
				}
				this.logActivity(`${event.username} joined collaboration`);
				this.notificationService.notify({
					severity: Severity.Info,
					message: `${event.username} has joined your coding session.`
				});
				break;
			case 'USER_LEFT':
				this.participants = this.participants.filter(p => p.username !== event.username);
				this._onDidParticipantsChange.fire([...this.participants]);
				this.logActivity(`${event.username} left collaboration`);
				this.clearParticipantDecorations(event.username);
				this.notificationService.notify({
					severity: Severity.Warning,
					message: `${event.username} left the session.`
				});
				break;
			case 'CHAT_MESSAGE':
				const chatMsg = { sender: event.username, text: event.payload, time: new Date(event.timestamp).toLocaleTimeString() };
				this.messages.push(chatMsg);
				this._onDidMessagesChange.fire([...this.messages]);
				if (event.username !== this.username) {
					this.notificationService.notify({
						severity: Severity.Info,
						message: `New message from ${event.username}: ${event.payload.substring(0, 30)}...`
					});
				}
				break;
			case 'CURSOR_MOVE':
				const cursorPresence = JSON.parse(event.payload);
				this.updateParticipantPresence(cursorPresence);
				this.updateRemoteCursorDecoration(
					cursorPresence.username,
					cursorPresence.activeFile,
					cursorPresence.cursorLine,
					cursorPresence.cursorColumn
				);
				break;
			case 'VOICE_STATUS':
				const voicePresence = JSON.parse(event.payload);
				this.updateParticipantPresence(voicePresence);
				break;
			case 'TEXT_EDIT':
				if (event.username === this.username) { break; } // Avoid echoing local edits back
				const editPayload = JSON.parse(event.payload);
				this.applyRemoteEdit(editPayload.filePath, editPayload.changes);
				break;
		}
	}

	private updateParticipantPresence(presence: any): void {
		const index = this.participants.findIndex(p => p.userId === presence.userId);
		if (index !== -1) {
			this.participants[index] = { ...this.participants[index], ...presence };
			this._onDidParticipantsChange.fire([...this.participants]);
		}
	}

	private applyRemoteEdit(filePath: string, changes: any[]): void {
		for (const editor of this.codeEditorService.listCodeEditors()) {
			const model = editor.getModel();
			if (model) {
				const currentPath = model.uri.path;
				if (currentPath === filePath) {
					this.isApplyingRemoteChange = true;
					try {
						const edits = changes.map(c => ({
							range: c.range,
							text: c.text,
							forceMoveMarkers: true
						}));
						model.pushEditOperations([], edits, () => null);
					} catch (e) {
						console.error('Failed to apply remote text edits:', e);
					} finally {
						this.isApplyingRemoteChange = false;
					}
				}
			}
		}
	}

	sendChatMessage(text: string): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			const event = {
				type: 'CHAT_MESSAGE',
				sessionId: this.sessionId,
				payload: text,
				timestamp: Date.now()
			};
			this.socket.send(JSON.stringify(event));
		}
	}

	sendCursorMove(line: number, col: number, activeFile: string): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			const presence = {
				userId: this.username,
				username: this.username,
				activeFile,
				cursorLine: line,
				cursorColumn: col,
				voiceMuted: this.voiceMuted
			};
			const event = {
				type: 'CURSOR_MOVE',
				sessionId: this.sessionId,
				payload: JSON.stringify(presence),
				timestamp: Date.now()
			};
			this.socket.send(JSON.stringify(event));
		}
	}

	sendTextEdit(filePath: string, changes: any[]): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			const payload = {
				filePath,
				changes
			};
			const event = {
				type: 'TEXT_EDIT',
				sessionId: this.sessionId,
				payload: JSON.stringify(payload),
				timestamp: Date.now()
			};
			this.socket.send(JSON.stringify(event));
		}
	}

	sendTerminalInput(terminalId: string, text: string): void {
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			const event = {
				type: 'TERMINAL_INPUT',
				sessionId: this.sessionId,
				payload: JSON.stringify({ terminalId, text }),
				timestamp: Date.now()
			};
			this.socket.send(JSON.stringify(event));
		}
	}

	toggleVoice(): void {
		this.voiceMuted = !this.voiceMuted;
		if (this.socket && this.socket.readyState === WebSocket.OPEN) {
			const presence = {
				userId: this.username,
				username: this.username,
				voiceMuted: this.voiceMuted
			};
			const event = {
				type: 'VOICE_STATUS',
				sessionId: this.sessionId,
				payload: JSON.stringify(presence),
				timestamp: Date.now()
			};
			this.socket.send(JSON.stringify(event));
		}
		this.logActivity(this.voiceMuted ? 'Voice channel muted' : 'Voice channel active');
	}

	async getRecentSessions(): Promise<any[]> {
		if (!this.token) { return []; }
		try {
			const context = await this.requestService.request({
				type: 'GET',
				url: `${this.baseUrl}/sessions/recent`,
				headers: { 'Authorization': `Bearer ${this.token}` },
				callSite: 'kyvoraCollaborationService'
			}, CancellationToken.None);
			if (context.res.statusCode === 401) {
				this.logout();
				this._onDidSessionExpired.fire();
			}
			return context.res.statusCode === 200 ? (await asJson<any[]>(context) || []) : [];
		} catch (e) {
			return [];
		}
	}

	private logActivity(message: string): void {
		const act = { text: message, time: new Date().toLocaleTimeString() };
		this.activities.unshift(act);
		if (this.activities.length > 50) { this.activities.pop(); }
		this._onDidActivityChange.fire([...this.activities]);
	}

	private clearParticipantDecorations(username: string): void {
		const decInfo = this.participantDecorations.get(username);
		if (decInfo) {
			for (const editor of this.codeEditorService.listCodeEditors()) {
				const model = editor.getModel();
				if (model && model.uri.toString() === decInfo.modelUri) {
					model.deltaDecorations(decInfo.decorationIds, []);
				}
			}
			this.participantDecorations.delete(username);
		}
	}

	private clearAllParticipantDecorations(): void {
		for (const username of this.participantDecorations.keys()) {
			this.clearParticipantDecorations(username);
		}
	}

	private updateRemoteCursorDecoration(username: string, activeFile: string, line: number, col: number): void {
		this.clearParticipantDecorations(username);

		if (!activeFile || activeFile === 'Untitled' || activeFile.trim() === '') {
			return;
		}

		for (const editor of this.codeEditorService.listCodeEditors()) {
			const model = editor.getModel();
			if (model) {
				const path = model.uri.path;
				if (path === activeFile || path.endsWith(activeFile) || activeFile.endsWith(path)) {
					const styleId = `kyvora-style-${username.replace(/[^a-zA-Z0-9]/g, '_')}`;
					if (typeof document !== 'undefined' && !document.getElementById(styleId)) {
						const getUsernameColor = (name: string) => {
							let hash = 0;
							for (let i = 0; i < name.length; i++) {
								hash = name.charCodeAt(i) + ((hash << 5) - hash);
							}
							const colors = ['#8B5CF6', '#D946EF', '#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#06B6D4'];
							const idx = Math.abs(hash) % colors.length;
							return colors[idx];
						};
						const color = getUsernameColor(username);
						const style = document.createElement('style');
						style.id = styleId;
						style.textContent = `
							.kyvora-cursor-${username.replace(/[^a-zA-Z0-9]/g, '_')} {
								border-left: 2px solid ${color} !important;
								margin-left: -1px;
								animation: blink 1s step-end infinite;
							}
							@keyframes blink {
								from, to { border-color: transparent }
								50% { border-color: ${color} }
							}
						`;
						document.head.appendChild(style);
					}

					const range = new Range(line, col, line, col);
					const newDecorationIds = model.deltaDecorations([], [{
						range,
						options: {
							description: 'remote-cursor-' + username,
							className: `kyvora-cursor-${username.replace(/[^a-zA-Z0-9]/g, '_')}`,
							hoverMessage: { value: `**${username}** is coding here` }
						}
					}]);

					this.participantDecorations.set(username, {
						modelUri: model.uri.toString(),
						decorationIds: newDecorationIds
					});
					break;
				}
			}
		}
	}
}
