import { IKyvoraCollaborationService } from '../common/kyvoraCollaborationService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

export class CollaborationPanel extends Disposable {
	public static readonly VIEW_ID = 'kyvora.collaborationView';

	private _webview: { postMessage(message: any): void } | null = null;

	constructor(
		@IKyvoraCollaborationService private readonly collabService: IKyvoraCollaborationService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
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
			justify-content: center;
			align-items: center;
			height: 100vh;
			width: 100vw;
			padding: 24px;
			background: var(--bg-deepest);
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
				<label>Username</label>
				<input type="text" id="loginUsername" placeholder="Enter username" />
			</div>
			<div class="input-group">
				<label>Password</label>
				<input type="password" id="loginPassword" placeholder="Enter password" />
			</div>
			<button class="btn" onclick="submitLogin()">Sign In</button>
			<div class="auth-toggle-link" onclick="toggleAuth(true)">Need an account? Sign Up</div>
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
				<button class="btn-logout" onclick="logout()">Sign Out</button>
			</div>
		</div>

		<div class="tabs">
			<button class="tab-btn active" onclick="switchTab('sessions')">Sessions</button>
			<button class="tab-btn" onclick="switchTab('presence')">Participants</button>
			<button class="tab-btn" onclick="switchTab('chat')">Live Chat</button>
			<button class="tab-btn" onclick="switchTab('activity')">Activity</button>
		</div>

		<div class="panel-content">
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

		function logout() {
			vscode.postMessage({ command: 'logout' });
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
						<span style="font-size: 10px; color: var(--text-muted)">\${p.voiceMuted ? '🔇' : '🎙️'}</span>
					</div>
				\`;
				list.appendChild(item);
			});
		}

		function sendSuggestion(text) {
			vscode.postMessage({ command: 'sendChatMessage', text });
		}

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
				textDiv.textContent = text;
				bubble.appendChild(textDiv);

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

		// Initial request for recent rooms and state sync
		vscode.postMessage({ command: 'getRecentSessions' });
		vscode.postMessage({ command: 'requestStateSync' });
	</script>
</body>
</html>`;
	}
}
