import { IKyvoraAgentService } from '../common/kyvoraAgentService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

/**
 * Agent Hub Panel — orchestrates communication between the webview UI
 * and the backend KyvoraAgentService.
 */
export class AgentHubPanel extends Disposable {
	public static readonly VIEW_ID = 'kyvora.agentHubView';

	private _webview: { postMessage(message: any): void } | null = null;

	constructor(
		@IKyvoraAgentService private readonly agentService: IKyvoraAgentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super();
		this.registerListeners();
	}

	setWebview(webview: { postMessage(message: any): void }): void {
		this._webview = webview;
		const plan = this.agentService.getCurrentPlan();
		if (plan) {
			webview.postMessage({ type: 'planUpdated', plan });
		}
	}

	private registerListeners(): void {
		this._register(this.agentService.onPlanUpdated((plan) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'planUpdated', plan });
			}
			this.telemetryService.publicLog('kyvora.planUpdated', {
				taskId: plan.taskId
			});
		}));

		this._register(this.agentService.onAgentStatusChanged((data) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'agentStatus', data });
			}
			this.telemetryService.publicLog('kyvora.agentStatus', {
				agentId: data.agentId,
				status: data.status
			});
		}));

		this._register(this.agentService.onMessageReceived((msg) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'busMessage', msg });
			}
			this.telemetryService.publicLog('kyvora.agentMessage', {
				from: msg.from,
				to: msg.to,
				type: msg.type
			});
		}));

		this._register(this.agentService.onConflictDetected((conflict) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'conflictDetected', conflict });
			}
			this.telemetryService.publicLog('kyvora.conflictDetected', {
				filePath: conflict.filePath
			});
		}));

		this._register(this.agentService.onPipelineUpdated((pipeline) => {
			if (this._webview) {
				this._webview.postMessage({ type: 'pipelineUpdated', pipeline });
			}
			this.telemetryService.publicLog('kyvora.pipelineUpdated', {
				pipelineName: pipeline.name,
				status: pipeline.status
			});
		}));
	}

	async startTask(prompt: string): Promise<void> {
		await this.agentService.createPlan(prompt);
		await this.agentService.executePlan();
	}

	getHtmlContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Kyvora AI Studio</title>
	<link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&display=swap" rel="stylesheet">
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
			font-family: 'Outfit', system-ui, -apple-system, sans-serif;
			display: flex;
			height: 100vh;
			width: 100vw;
			overflow: hidden;
		}

		/* Main Glassmorphism container */
		.app-container {
			display: grid;
			grid-template-columns: 220px 1fr;
			width: 100%;
			height: 100%;
		}

		/* Left Sidebar Navigation */
		.sidebar {
			background: var(--bg-panel);
			border-right: 1px solid var(--border-subtle);
			display: flex;
			flex-direction: column;
			padding: 16px;
			gap: 16px;
		}

		.sidebar-brand {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 4px 8px;
			margin-bottom: 8px;
		}

		.sidebar-brand svg {
			animation: spin-glow 15s linear infinite;
		}

		@keyframes spin-glow {
			0% { transform: rotate(0deg); filter: drop-shadow(0 0 2px var(--accent-primary)); }
			50% { filter: drop-shadow(0 0 6px var(--accent-secondary)); }
			100% { transform: rotate(360deg); filter: drop-shadow(0 0 2px var(--accent-primary)); }
		}

		.sidebar-brand h1 {
			font-size: 13px;
			font-weight: 700;
			letter-spacing: 1.5px;
			background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
			-webkit-background-clip: text;
			-webkit-text-fill-color: transparent;
		}

		.nav-menu {
			display: flex;
			flex-direction: column;
			gap: 4px;
			flex: 1;
			overflow-y: auto;
		}

		.nav-item {
			display: flex;
			align-items: center;
			gap: 10px;
			padding: 8px 12px;
			border-radius: 6px;
			color: var(--text-secondary);
			font-size: 11.5px;
			font-weight: 500;
			cursor: pointer;
			transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
			text-align: left;
			background: transparent;
			border: none;
			width: 100%;
		}

		.nav-item:hover {
			background: var(--bg-hover);
			color: var(--text-primary);
		}

		.nav-item.active {
			background: var(--bg-accent);
			color: var(--accent-bright);
			border: 1px solid var(--border-accent);
			box-shadow: 0 4px 12px var(--accent-glow);
		}

		/* Provider selector in Sidebar footer */
		.sidebar-footer {
			border-top: 1px solid var(--border-subtle);
			padding-top: 12px;
			display: flex;
			flex-direction: column;
			gap: 8px;
		}

		.provider-select-group {
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.provider-select-group label {
			font-size: 9px;
			text-transform: uppercase;
			color: var(--text-muted);
			font-weight: 600;
			letter-spacing: 0.5px;
		}

		.sidebar-select {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			border-radius: 4px;
			color: var(--text-primary);
			padding: 6px;
			font-size: 11px;
			outline: none;
			width: 100%;
			cursor: pointer;
			transition: border 0.2s;
		}

		.sidebar-select:focus {
			border-color: var(--accent-primary);
		}

		/* Main Content Panel */
		.main-content {
			display: flex;
			flex-direction: column;
			height: 100%;
			overflow: hidden;
			background: var(--bg-deepest);
		}

		/* Main Panels (mapped to tabs) */
		.tab-panel {
			display: none;
			flex-direction: column;
			height: 100%;
			padding: 16px;
			overflow-y: auto;
		}

		.tab-panel.active {
			display: flex;
		}

		/* Global styling inside panels */
		.panel-header {
			margin-bottom: 16px;
		}

		.panel-header h2 {
			font-size: 15px;
			font-weight: 600;
			color: var(--text-primary);
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.panel-header p {
			font-size: 11px;
			color: var(--text-secondary);
			margin-top: 2px;
		}

		/* Task input section */
		.task-bar {
			display: flex;
			gap: 8px;
			margin-bottom: 16px;
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			padding: 8px;
			border-radius: 8px;
			align-items: center;
		}

		.task-bar textarea {
			flex: 1;
			background: transparent;
			border: none;
			color: var(--text-primary);
			font-size: 12px;
			resize: none;
			min-height: 24px;
			max-height: 120px;
			outline: none;
			font-family: inherit;
		}

		.task-bar button {
			background: linear-gradient(135deg, var(--accent-primary), var(--accent-secondary));
			border: none;
			color: white;
			padding: 6px 12px;
			border-radius: 6px;
			cursor: pointer;
			font-weight: 600;
			font-size: 11px;
			display: flex;
			align-items: center;
			gap: 6px;
			transition: all 0.2s;
		}

		.task-bar button:hover {
			filter: brightness(1.1);
			transform: translateY(-1px);
			box-shadow: 0 4px 12px var(--accent-glow);
		}

		/* Workspace Grid */
		.workspace-layout {
			display: grid;
			grid-template-columns: 200px 1fr;
			gap: 12px;
			flex: 1;
			min-height: 0;
		}

		.card-panel {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 12px;
			display: flex;
			flex-direction: column;
			overflow-y: auto;
			min-height: 0;
		}

		.card-title {
			font-size: 10px;
			text-transform: uppercase;
			color: var(--accent-bright);
			font-weight: 700;
			margin-bottom: 10px;
			letter-spacing: 1px;
		}

		/* Agents List */
		.agent-row {
			display: flex;
			align-items: center;
			gap: 8px;
			padding: 6px 8px;
			border-radius: 4px;
			font-size: 11px;
			margin-bottom: 4px;
			transition: background 0.2s;
		}

		.agent-row:hover {
			background: var(--bg-hover);
		}

		.agent-status-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			background: var(--text-muted);
		}

		.agent-status-dot.working {
			background: var(--accent-primary);
			box-shadow: 0 0 8px var(--accent-primary);
			animation: pulse 1.2s infinite;
		}

		.agent-status-dot.idle {
			background: var(--text-muted);
		}

		/* Subtask Items */
		.subtask-box {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 10px;
			margin-bottom: 8px;
			transition: all 0.2s;
		}

		.subtask-box.running {
			border-color: var(--accent-primary);
			background: var(--bg-accent);
		}

		.subtask-box.completed {
			border-color: var(--green);
		}

		.subtask-box.failed {
			border-color: var(--red);
		}

		.subtask-header {
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 4px;
		}

		.subtask-name {
			font-size: 11.5px;
			font-weight: 600;
			color: var(--text-primary);
		}

		.subtask-agent-lbl {
			font-size: 9px;
			color: var(--blue);
			background: rgba(59, 130, 246, 0.1);
			padding: 2px 6px;
			border-radius: 4px;
			font-weight: 500;
		}

		.subtask-desc {
			font-size: 10.5px;
			color: var(--text-secondary);
			line-height: 1.4;
		}

		/* Live console log */
		.console-log {
			background: #050508;
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 10px;
			font-family: "Cascadia Code", "Fira Code", Courier, monospace;
			font-size: 10.5px;
			color: var(--text-secondary);
			height: 120px;
			overflow-y: auto;
			margin-top: 12px;
		}

		.console-line {
			margin-bottom: 4px;
			line-height: 1.5;
		}

		.console-line .sys { color: var(--text-muted); }
		.console-line .agent { color: var(--accent-bright); }
		.console-line .action { color: var(--blue); }

		/* AI Workspace Chat Tab */
		.chat-container {
			display: flex;
			flex-direction: column;
			height: 100%;
			min-height: 0;
		}

		.chat-history {
			flex: 1;
			overflow-y: auto;
			padding-right: 4px;
			display: flex;
			flex-direction: column;
			gap: 12px;
			margin-bottom: 12px;
			min-height: 0;
		}

		.chat-bubble {
			display: flex;
			flex-direction: column;
			max-width: 85%;
			padding: 10px 14px;
			border-radius: 8px;
			font-size: 12px;
			line-height: 1.5;
		}

		.chat-bubble.user {
			align-self: flex-end;
			background: var(--bg-accent);
			border: 1px solid var(--border-accent);
			color: var(--accent-bright);
		}

		.chat-bubble.ai {
			align-self: flex-start;
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
		}

		.chat-bubble p {
			margin-bottom: 8px;
		}

		.chat-bubble code {
			background: var(--bg-hover);
			padding: 2px 4px;
			border-radius: 4px;
			font-family: monospace;
		}

		.chat-bubble pre {
			background: #050508;
			padding: 8px;
			border-radius: 6px;
			overflow-x: auto;
			margin: 6px 0;
		}

		.chat-bubble pre code {
			background: transparent;
			padding: 0;
		}

		.chat-input-row {
			display: flex;
			gap: 8px;
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			padding: 8px;
			border-radius: 8px;
		}

		.chat-input-row input {
			flex: 1;
			background: transparent;
			border: none;
			color: var(--text-primary);
			font-size: 12px;
			outline: none;
		}

		.chat-input-row button {
			background: var(--accent-primary);
			border: none;
			color: white;
			padding: 6px 12px;
			border-radius: 6px;
			cursor: pointer;
			font-size: 11px;
			font-weight: 600;
		}

		/* Common Tasks list in Chat */
		.quick-tasks {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
			gap: 6px;
			margin-bottom: 12px;
		}

		.quick-task-card {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 8px;
			cursor: pointer;
			text-align: center;
			font-size: 11px;
			transition: all 0.2s;
		}

		.quick-task-card:hover {
			border-color: var(--accent-primary);
			background: var(--bg-hover);
		}

		/* Feature Toggles Panel */
		.features-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
			gap: 12px;
		}

		.feature-card {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 12px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}

		.feature-info {
			display: flex;
			flex-direction: column;
			gap: 2px;
		}

		.feature-name {
			font-size: 12px;
			font-weight: 600;
			color: var(--text-primary);
		}

		.feature-desc {
			font-size: 10px;
			color: var(--text-secondary);
		}

		/* Switch design */
		.switch {
			position: relative;
			display: inline-block;
			width: 32px;
			height: 18px;
			flex-shrink: 0;
		}

		.switch input {
			opacity: 0;
			width: 0;
			height: 0;
		}

		.slider {
			position: absolute;
			cursor: pointer;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: var(--text-muted);
			transition: .3s;
			border-radius: 18px;
		}

		.slider:before {
			position: absolute;
			content: "";
			height: 14px;
			width: 14px;
			left: 2px;
			bottom: 2px;
			background-color: white;
			transition: .3s;
			border-radius: 50%;
		}

		input:checked + .slider {
			background-color: var(--accent-primary);
		}

		input:checked + .slider:before {
			transform: translateX(14px);
		}

		/* Dashboard Statistics Panel */
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
			gap: 12px;
			margin-bottom: 20px;
		}

		.stat-card {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 14px;
			text-align: center;
			display: flex;
			flex-direction: column;
			gap: 4px;
		}

		.stat-val {
			font-size: 18px;
			font-weight: 700;
			color: var(--accent-bright);
		}

		.stat-lbl {
			font-size: 10px;
			color: var(--text-secondary);
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}

		/* API key list */
		.key-row {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 10px 14px;
			margin-bottom: 8px;
			display: flex;
			align-items: center;
			justify-content: space-between;
			gap: 12px;
		}

		.key-provider-info {
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.key-status-icon {
			width: 8px;
			height: 8px;
			border-radius: 50%;
		}

		.key-status-icon.configured { background: var(--green); box-shadow: 0 0 6px var(--green); }
		.key-status-icon.missing { background: var(--orange); }

		.key-input-area {
			display: flex;
			gap: 6px;
			flex: 1;
			max-width: 320px;
		}

		.key-input-area input {
			flex: 1;
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			border-radius: 4px;
			padding: 4px 8px;
			font-size: 11px;
			outline: none;
		}

		.key-input-area button {
			background: var(--bg-hover);
			border: 1px solid var(--border-subtle);
			color: var(--text-primary);
			padding: 4px 10px;
			border-radius: 4px;
			font-size: 11px;
			cursor: pointer;
			transition: all 0.2s;
		}

		.key-input-area button:hover {
			background: var(--accent-primary);
			color: white;
		}

		/* Deployment Panel */
		.deploy-platforms {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
			gap: 8px;
			margin-bottom: 16px;
		}

		.platform-card {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 14px 10px;
			text-align: center;
			cursor: pointer;
			font-size: 11px;
			transition: all 0.2s;
		}

		.platform-card:hover {
			border-color: var(--accent-primary);
			background: var(--bg-hover);
		}

		.platform-card.selected {
			border-color: var(--accent-secondary);
			background: var(--bg-accent);
			color: var(--accent-bright);
		}

		.terminal-box {
			background: #030305;
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 12px;
			font-family: monospace;
			font-size: 10.5px;
			color: #39FF14;
			height: 180px;
			overflow-y: auto;
			margin-top: 12px;
		}

		/* AI Fix / Diff Visualizer */
		.fix-layout {
			display: grid;
			grid-template-columns: 1fr;
			gap: 12px;
		}

		.diff-container {
			background: #050508;
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			font-family: monospace;
			font-size: 10.5px;
			padding: 10px;
			overflow-x: auto;
			max-height: 240px;
		}

		.diff-line {
			display: flex;
			white-space: pre;
		}

		.diff-line.addition { background: rgba(16, 185, 129, 0.15); color: #2ecc71; }
		.diff-line.deletion { background: rgba(239, 68, 68, 0.15); color: #e74c3c; }

		.action-row {
			display: flex;
			gap: 8px;
			margin-top: 10px;
		}

		.btn-success { background: var(--green); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }
		.btn-danger { background: var(--red); border: none; color: white; padding: 6px 12px; border-radius: 4px; cursor: pointer; font-size: 11px; font-weight: 600; }
	</style>
</head>
<body>
	<div class="app-container">
		<!-- Sidebar Navigation -->
		<div class="sidebar">
			<div class="sidebar-brand">
				<svg width="20" height="20" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
					<polygon points="50,12 83,31 83,69 50,88 17,69 17,31" stroke="url(#sidebar-brand-grad)" stroke-width="6" fill="none" />
					<defs>
						<linearGradient id="sidebar-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
							<stop offset="0%" stop-color="#8B5CF6" />
							<stop offset="100%" stop-color="#D946EF" />
						</linearGradient>
					</defs>
					<path d="M34 26 V74 M34 50 C 45 42, 58 35, 68 28 M34 50 C 48 55, 56 66, 68 72" stroke="white" stroke-width="10" stroke-linecap="round" />
				</svg>
				<h1>KYVORA AI</h1>
			</div>

			<div class="nav-menu">
				<button class="nav-item active" onclick="switchTab('agent-hub')">
					⬡ Agent Hub (Agent Mode)
				</button>
				<button class="nav-item" onclick="switchTab('workspace-chat')">
					💬 AI Workspace Chat
				</button>
				<button class="nav-item" onclick="switchTab('feature-flags')">
					⚙️ Toggle AI Features
				</button>
				<button class="nav-item" onclick="switchTab('usage-dashboard')">
					📊 Usage Dashboard
				</button>
				<button class="nav-item" onclick="switchTab('auto-deployment')">
					🚀 Auto Deployment
				</button>
				<button class="nav-item" onclick="switchTab('code-review-panel')">
					✨ Review, Docs & Tests
				</button>
				<button class="nav-item" onclick="switchTab('ai-fix-panel')" id="fixNavBtn" style="display:none;">
					🩹 AI Error Auto-Fix
				</button>
			</div>

			<!-- Sidebar Footer Settings -->
			<div class="sidebar-footer">
				<div class="provider-select-group">
					<label>AI Provider</label>
					<select class="sidebar-select" id="providerSelect" onchange="changeProvider()">
						<option value="gemini">Google Gemini</option>
						<option value="openrouter">OpenRouter</option>
						<option value="groq">Groq</option>
						<option value="huggingface">HuggingFace</option>
						<option value="sambanova">SambaNova</option>
					</select>
				</div>
				<div class="provider-select-group">
					<label>AI Model</label>
					<select class="sidebar-select" id="modelSelect" onchange="changeModel()">
						<option value="Auto">Auto Mode</option>
					</select>
				</div>
			</div>
		</div>

		<!-- Main Panel Area -->
		<div class="main-content">
			<!-- Tab: Agent Hub -->
			<div class="tab-panel active" id="tab-agent-hub">
				<div class="panel-header">
					<h2>⬡ Autonomous Agent Mode</h2>
					<p>Describe what to build and watch specialized agents coordinate to solve the task.</p>
				</div>

				<div class="task-bar">
					<textarea id="taskInput" placeholder="Build a features, generate files, modify codes... (e.g. Build JWT auth services)"></textarea>
					<button onclick="startAgentTask()">▶ RUN</button>
				</div>

				<div class="workspace-layout">
					<div class="card-panel">
						<div class="card-title">Agents Registry</div>
						<div class="agent-row" id="agent-orchestrator"><span class="agent-status-dot idle"></span>Orchestrator</div>
						<div class="agent-row" id="agent-architect"><span class="agent-status-dot idle"></span>Architect</div>
						<div class="agent-row" id="agent-coder"><span class="agent-status-dot idle"></span>Coder</div>
						<div class="agent-row" id="agent-reviewer"><span class="agent-status-dot idle"></span>Reviewer</div>
						<div class="agent-row" id="agent-tester"><span class="agent-status-dot idle"></span>Tester</div>
						<div class="agent-row" id="agent-debugger"><span class="agent-status-dot idle"></span>Debugger</div>
						<div class="agent-row" id="agent-security"><span class="agent-status-dot idle"></span>Security</div>
						<div class="agent-row" id="agent-searcher"><span class="agent-status-dot idle"></span>Searcher</div>
					</div>
					<div class="card-panel" id="planBox">
						<div class="card-title">Execution Plan</div>
						<p style="color: var(--text-muted); font-size: 11px;">Awaiting instructions. Enter a task above to generate plan.</p>
					</div>
				</div>

				<div class="console-log" id="consoleLog">
					<div class="console-line"><span class="sys">[SYS]</span> Kyvora Agent Sandbox initialized. Secure file modification, command execution, and code review enabled.</div>
				</div>
			</div>

			<!-- Tab: Workspace Chat -->
			<div class="tab-panel" id="tab-workspace-chat">
				<div class="panel-header">
					<h2>💬 AI Workspace Chat</h2>
					<p>Ask details about the workspace. Prompts are fully aware of folder tree and active files.</p>
				</div>

				<div class="quick-tasks">
					<div class="quick-task-card" onclick="chatQuickTask('Explain the architecture of this project')">🏢 Explain Architecture</div>
					<div class="quick-task-card" onclick="chatQuickTask('Find security vulnerabilities in active file')">🛡️ Security Check</div>
					<div class="quick-task-card" onclick="chatQuickTask('Convert code to Kotlin/Typescript boilerplate')">🔄 Convert Code</div>
					<div class="quick-task-card" onclick="chatQuickTask('Generate API endpoints with robust JWT checks')">🔑 Add JWT Auth</div>
				</div>

				<div class="chat-container">
					<div class="chat-history" id="chatHistory">
						<div class="chat-bubble ai">
							<p>Hello! I am Kyvora Studio AI. I understand the entire workspace. How can I help you program today?</p>
						</div>
					</div>

					<div class="chat-input-row">
						<input type="text" id="chatInput" placeholder="Ask anything about the project..." onkeypress="handleChatEnter(event)" />
						<button onclick="sendChatMessage()">SEND</button>
					</div>
				</div>
			</div>

			<!-- Tab: Feature Toggles -->
			<div class="tab-panel" id="tab-feature-flags">
				<div class="panel-header">
					<h2>⚙️ Toggle AI Features</h2>
					<p>Enable/disable specific AI processes in the background of Kyvora IDE.</p>
				</div>

				<div class="features-grid" id="featuresGrid">
					<!-- Dynamically injected -->
				</div>
			</div>

			<!-- Tab: Usage Dashboard -->
			<div class="tab-panel" id="tab-usage-dashboard">
				<div class="panel-header">
					<h2>📊 Usage Dashboard</h2>
					<p>Token usage, estimation costs, and API credentials manager.</p>
				</div>

				<div class="stats-grid">
					<div class="stat-card">
						<div class="stat-val" id="statRequests">0</div>
						<div class="stat-lbl">Total Requests</div>
					</div>
					<div class="stat-card">
						<div class="stat-val" id="statInput">0</div>
						<div class="stat-lbl">Input Tokens</div>
					</div>
					<div class="stat-card">
						<div class="stat-val" id="statOutput">0</div>
						<div class="stat-lbl">Output Tokens</div>
					</div>
					<div class="stat-card">
						<div class="stat-val" id="statCost">$0.00</div>
						<div class="stat-lbl">Est. Cost (USD)</div>
					</div>
					<div class="stat-card">
						<div class="stat-val" id="statAvgTime">0ms</div>
						<div class="stat-lbl">Avg Response Time</div>
					</div>
				</div>

				<div class="card-title">Provider API Key Manager</div>
				<div id="apiKeysList">
					<!-- Dynamically injected -->
				</div>
			</div>

			<!-- Tab: Auto Deployment -->
			<div class="tab-panel" id="tab-auto-deployment">
				<div class="panel-header">
					<h2>🚀 Auto Deployment</h2>
					<p>Build, test, deploy, and rollback your workspace applications to popular cloud providers.</p>
				</div>

				<div class="deploy-platforms">
					<div class="platform-card selected" onclick="selectPlatform(this, 'Vercel')">Vercel</div>
					<div class="platform-card" onclick="selectPlatform(this, 'Netlify')">Netlify</div>
					<div class="platform-card" onclick="selectPlatform(this, 'Railway')">Railway</div>
					<div class="platform-card" onclick="selectPlatform(this, 'Render')">Render</div>
					<div class="platform-card" onclick="selectPlatform(this, 'Docker')">Docker Container</div>
				</div>

				<button class="btn-success" onclick="triggerDeployment()">🚀 Build & Deploy Application</button>

				<div class="terminal-box" id="deployTerminal">
					[SYSTEM] Deployment pipeline ready. Select platform and click deploy.
				</div>
			</div>

			<!-- Tab: Code Review, Docs & Tests -->
			<div class="tab-panel" id="tab-code-review-panel">
				<div class="panel-header">
					<h2>✨ Review, Docs & Tests</h2>
					<p>Run automated checks, update files documentations, and generate robust test code.</p>
				</div>

				<div style="display: flex; gap: 8px; margin-bottom: 16px;">
					<button class="btn-success" onclick="runCodeReview()" id="reviewBtn">🛡️ Code Review Workspace</button>
					<button class="btn-success" onclick="runDocsGenerator()" id="docsBtn">📝 Generate README & Docs</button>
					<button class="btn-success" onclick="runTestGenerator()" id="testsBtn">🧪 Generate Test Suite</button>
				</div>

				<div class="card-panel" style="flex:1;">
					<div class="card-title">Output Console</div>
					<div id="pipelineResult" style="font-size:12px; line-height:1.5; white-space: pre-wrap; color: var(--text-primary); max-height: 400px; overflow-y: auto;">
						Awaiting review or generation trigger...
					</div>
				</div>
			</div>

			<!-- Tab: AI Fix & Diff Preview -->
			<div class="tab-panel" id="tab-ai-fix-panel">
				<div class="panel-header">
					<h2>🩹 AI Error Auto-Fix</h2>
					<p>AI has analysed editor errors and proposed fix solutions.</p>
				</div>

				<div class="fix-layout">
					<div class="card-panel">
						<div class="card-title">Error Analysis</div>
						<p id="fixExplanation" style="font-size:12px; line-height:1.5; margin-bottom:12px;">Analyzing editor diagnostic...</p>
						
						<div style="display:grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom:12px;">
							<div class="subtask-box">
								<div class="subtask-name">Solution A (Recommended)</div>
								<div class="subtask-desc" id="solutionADesc">Loading...</div>
							</div>
							<div class="subtask-box">
								<div class="subtask-name">Solution B</div>
								<div class="subtask-desc" id="solutionBDesc">Loading...</div>
							</div>
						</div>
					</div>

					<div class="card-panel">
						<div class="card-title">Proposed Git Diff Preview</div>
						<div class="diff-container" id="diffContainer">
							<div class="diff-line">Loading proposed code changes...</div>
						</div>
					</div>

					<div class="action-row">
						<button class="btn-success" onclick="applyProposedFix()">Accept & Apply Fix</button>
						<button class="btn-danger" onclick="rejectProposedFix()">Reject / Revert changes</button>
					</div>
				</div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		let selectedPlatform = 'Vercel';
		let activeFixData = null;

		// Request stats on start
		vscode.postMessage({ command: 'getStats' });

		function switchTab(tabId) {
			// Remove active class from all tabs
			const panels = document.querySelectorAll('.tab-panel');
			panels.forEach(p => p.classList.remove('active'));

			const navs = document.querySelectorAll('.nav-item');
			navs.forEach(n => n.classList.remove('active'));

			// Activate selected
			document.getElementById('tab-' + tabId).classList.add('active');
			
			// Find nav button
			const btn = Array.from(navs).find(n => n.getAttribute('onclick').includes(tabId));
			if (btn) btn.classList.add('active');
		}

		function startAgentTask() {
			const prompt = document.getElementById('taskInput').value.trim();
			if (prompt) {
				vscode.postMessage({ command: 'startTask', prompt: prompt });
				logConsole('SYS', 'Decomposing task architecture and triggering orchestrator...');
			}
		}

		function logConsole(agent, text) {
			const box = document.getElementById('consoleLog');
			const div = document.createElement('div');
			div.className = 'console-line';
			div.innerHTML = '<span class="agent">[' + agent + ']</span> <span class="sys">' + text + '</span>';
			box.appendChild(div);
			box.scrollTop = box.scrollHeight;
		}

		function changeProvider() {
			const prov = document.getElementById('providerSelect').value;
			vscode.postMessage({ command: 'updateProvider', provider: prov });
		}

		function changeModel() {
			const model = document.getElementById('modelSelect').value;
			vscode.postMessage({ command: 'updateModel', model: model });
		}

		function toggleFeature(featureId, checkbox) {
			vscode.postMessage({ command: 'updateFeature', id: featureId, enabled: checkbox.checked });
		}

		function saveKey(provider) {
			const key = document.getElementById('key-input-' + provider).value.trim();
			if (key) {
				vscode.postMessage({ command: 'saveApiKey', provider: provider, key: key });
			}
		}

		function handleChatEnter(e) {
			if (e.key === 'Enter') {
				sendChatMessage();
			}
		}

		function sendChatMessage() {
			const input = document.getElementById('chatInput');
			const msg = input.value.trim();
			if (msg) {
				vscode.postMessage({ command: 'sendChatMessage', message: msg });
				input.value = '';
			}
		}

		function chatQuickTask(prompt) {
			vscode.postMessage({ command: 'sendChatMessage', message: prompt });
		}

		function selectPlatform(card, name) {
			const cards = document.querySelectorAll('.platform-card');
			cards.forEach(c => c.classList.remove('selected'));
			card.classList.add('selected');
			selectedPlatform = name;
		}

		function triggerDeployment() {
			vscode.postMessage({ command: 'deployProject', platform: selectedPlatform });
		}

		function runCodeReview() {
			document.getElementById('reviewBtn').disabled = true;
			document.getElementById('pipelineResult').innerText = 'Generating comprehensive workspace review...';
			vscode.postMessage({ command: 'runCodeReview' });
		}

		function runDocsGenerator() {
			document.getElementById('docsBtn').disabled = true;
			document.getElementById('pipelineResult').innerText = 'Generating documentation (README, Architecture flow diagrams)...';
			vscode.postMessage({ command: 'runDocsGenerator' });
		}

		function runTestGenerator() {
			document.getElementById('testsBtn').disabled = true;
			document.getElementById('pipelineResult').innerText = 'Generating unit & integration test suites...';
			vscode.postMessage({ command: 'runTestGenerator', filePath: '' });
		}

		function applyProposedFix() {
			logConsole('SYS', 'Proposed fix successfully applied to file.');
			switchTab('agent-hub');
			document.getElementById('fixNavBtn').style.display = 'none';
		}

		function rejectProposedFix() {
			logConsole('SYS', 'Proposed fix rejected.');
			switchTab('agent-hub');
			document.getElementById('fixNavBtn').style.display = 'none';
		}

		window.addEventListener('message', (event) => {
			const msg = event.data;
			switch (msg.type) {
				case 'statsUpdated':
					renderStats(msg.data);
					break;
				case 'planUpdated':
					renderPlan(msg.plan);
					break;
				case 'agentStatus':
					renderAgentStatus(msg.data);
					break;
				case 'busMessage':
					logConsole(msg.msg.from, msg.msg.type + ' -> ' + msg.msg.to);
					break;
				case 'chatMessage':
					appendChatMessage(msg.sender, msg.text);
					break;
				case 'chatStatus':
					if (msg.status === 'thinking') {
						appendChatMessage('ai-thinking', 'Thinking...');
					} else {
						removeThinkingMessage();
					}
					break;
				case 'reviewStatus':
					document.getElementById('pipelineResult').innerText = 'AI review in progress... Please wait.';
					break;
				case 'reviewResult':
					document.getElementById('reviewBtn').disabled = false;
					document.getElementById('pipelineResult').innerText = msg.result;
					break;
				case 'docsStatus':
					document.getElementById('pipelineResult').innerText = 'Generating workspace documentation...';
					break;
				case 'docsResult':
					document.getElementById('docsBtn').disabled = false;
					document.getElementById('pipelineResult').innerText = msg.result;
					break;
				case 'testStatus':
					document.getElementById('pipelineResult').innerText = 'Writing test suite classes...';
					break;
				case 'testResult':
					document.getElementById('testsBtn').disabled = false;
					document.getElementById('pipelineResult').innerText = msg.result;
					break;
				case 'deployStatus':
					appendDeployLog(msg.step, msg.index, msg.total);
					break;
				case 'deploySuccess':
					finishDeployLog(msg.url, msg.platform, msg.timestamp);
					break;
				case 'triggerFixWithAI':
					triggerFixFlow(msg.uri, msg.marker);
					break;
				case 'fixStatus':
					document.getElementById('fixExplanation').innerText = 'AI model is analyzing compiler diagnostics...';
					break;
				case 'fixResult':
					renderFixResult(msg.data);
					break;
			}
		});

		function renderStats(data) {
			// Update dropdown selections
			document.getElementById('providerSelect').value = data.provider;
			
			// Rebuild Model dropdown options based on provider
			const modelSelect = document.getElementById('modelSelect');
			modelSelect.innerHTML = '';
			data.models.forEach(m => {
				const opt = document.createElement('option');
				opt.value = m;
				opt.innerText = m;
				modelSelect.appendChild(opt);
			});
			modelSelect.value = data.model;

			// Update dashboard figures
			document.getElementById('statRequests').innerText = data.stats.requests;
			document.getElementById('statInput').innerText = data.stats.inputTokens;
			document.getElementById('statOutput').innerText = data.stats.outputTokens;
			document.getElementById('statCost').innerText = '$' + data.stats.estimatedCost.toFixed(4);
			document.getElementById('statAvgTime').innerText = data.stats.averageResponseTime + 'ms';

			// Render Feature Toggles list
			const grid = document.getElementById('featuresGrid');
			grid.innerHTML = '';
			const featureFriendlyNames = {
				inlineSuggestions: ['Inline AI Suggestions', 'Ghost text, completion, boilerplate predicts'],
				errorDetection: ['Continuous Error Detection', 'Scan and analyze TS, Spring Boot, React, Python issues'],
				autoFix: ['AI Fix Button', 'Display ✨ Fix with AI for lint/compiler errors'],
				aiChat: ['AI Chat Panel', 'Ask questions about codebase architecture'],
				codeReview: ['One-Click Code Review', 'Auto audit security, complexity and readability'],
				docGenerator: ['Technical Documentation', 'Auto build READMEs and API Javadoc structures'],
				testGenerator: ['Automated Testing suite', 'Generate JUnit, Mockito, and frontend tests'],
				perfAnalysis: ['Performance Analyzer', 'Detect memory leaks and logic hotspots'],
				securityAnalysis: ['OWASP Security Scan', 'Flag SQLi, XSS, and hardcoded tokens'],
				autoImports: ['Auto Imports Resolver', 'Auto resolve typescript and java package imports'],
				autoRename: ['AI Smart Rename', 'Suggest meaningful variables names'],
				autoRefactor: ['Logic Simplifier', 'Streamline complex loops and functions'],
				aiAgent: ['Autonomous Agent mode', 'Orchestrate search, compile, dependency setups'],
				autoTerminal: ['Terminal commands assistant', 'Run builds, start servers automatically'],
				projectAnalysis: ['Workspace structure scanner', 'Analyze project folders automatically']
			};

			Object.keys(data.features).forEach(fid => {
				const card = document.createElement('div');
				card.className = 'feature-card';
				const info = featureFriendlyNames[fid] || [fid, 'Configure settings'];
				card.innerHTML = \`
					<div class="feature-info">
						<span class="feature-name">\${info[0]}</span>
						<span class="feature-desc">\${info[1]}</span>
					</div>
					<label class="switch">
						<input type="checkbox" \${data.features[fid] ? 'checked' : ''} onchange="toggleFeature('\${fid}', this)">
						<span class="slider"></span>
					</label>
				\`;
				grid.appendChild(card);
			});

			// Render API keys list
			const keyList = document.getElementById('apiKeysList');
			keyList.innerHTML = '';
			const providerDisplay = {
				gemini: 'Google Gemini AI',
				openrouter: 'OpenRouter API',
				groq: 'Groq Cloud API',
				huggingface: 'HuggingFace Inference',
				sambanova: 'SambaNova Systems'
			};

			data.allProviders.forEach(p => {
				const hasKey = data.keys[p];
				const row = document.createElement('div');
				row.className = 'key-row';
				row.innerHTML = \`
					<div class="key-provider-info">
						<span class="key-status-icon \${hasKey ? 'configured' : 'missing'}"></span>
						<span style="font-size:12px; font-weight:600;">\${providerDisplay[p]}</span>
					</div>
					<div class="key-input-area">
						<input type="password" id="key-input-\${p}" placeholder="\${hasKey ? '••••••••••••••••••••••••' : 'Add API key...'}" />
						<button onclick="saveKey('\${p}')">Save</button>
					</div>
				\`;
				keyList.appendChild(row);
			});
		}

		function renderPlan(plan) {
			const box = document.getElementById('planBox');
			box.innerHTML = '<div class="card-title">Execution Plan (\${plan.subtasks.length} subtasks)</div>';
			plan.subtasks.forEach(t => {
				const div = document.createElement('div');
				div.className = 'subtask-box ' + t.status;
				div.innerHTML = \`
					<div class="subtask-header">
						<span class="subtask-name">\${t.title}</span>
						<span class="subtask-agent-lbl">\${t.assignedAgent}</span>
					</div>
					<p class="subtask-desc">\${t.description}</p>
					<div style="font-size:9.5px; color: var(--text-secondary); margin-top:6px;">Status: \${t.status.toUpperCase()}</div>
				\`;
				box.appendChild(div);
			});
		}

		function renderAgentStatus(data) {
			const row = document.getElementById('agent-' + data.agentId);
			if (row) {
				const dot = row.querySelector('.agent-status-dot');
				if (dot) {
					dot.className = 'agent-status-dot ' + (data.status === 'idle' ? 'idle' : 'working');
				}
				row.className = 'agent-row ' + (data.status === 'idle' ? '' : 'working');
			}
		}

		function appendChatMessage(sender, text) {
			const hist = document.getElementById('chatHistory');
			const div = document.createElement('div');
			div.className = 'chat-bubble ' + (sender === 'user' ? 'user' : 'ai');

			if (sender === 'ai-thinking') {
				div.id = 'chat-thinking-bubble';
				div.innerText = text;
			} else {
				// simple markdown formatter helper for clean chat view
				let cleanText = text
					.replace(/\\n/g, '<br>')
					.replace(/\\\`\\\`\\\`([a-zA-Z]*)(.*?)\\\`\\\`\\\`/gs, '<pre><code>$2</code></pre>')
					.replace(/\\\`(.*?)\\\`/g, '<code>$1</code>');
				div.innerHTML = cleanText;
			}

			hist.appendChild(div);
			hist.scrollTop = hist.scrollHeight;
		}

		function removeThinkingMessage() {
			const el = document.getElementById('chat-thinking-bubble');
			if (el) el.remove();
		}

		function appendDeployLog(step, index, total) {
			const term = document.getElementById('deployTerminal');
			const line = document.createElement('div');
			line.innerText = \`[\${index}/\${total}] \${step}\`;
			term.appendChild(line);
			term.scrollTop = term.scrollHeight;
		}

		function finishDeployLog(url, platform, time) {
			const term = document.getElementById('deployTerminal');
			line.style.color = '#38bdf8';
			line.innerHTML = \`\n🚀 BUILD AND DEPLOYMENT SUCCESSFUL!\nPlatform: \${platform}\nTimestamp: \${time}\nLive Preview URL: <a href="\${url}" target="_blank" style="color:#22c55e;">\${url}</a>\`;
			term.appendChild(line);
			term.scrollTop = term.scrollHeight;
		}

		function triggerFixFlow(uri, marker) {
			// Show the fix navigation button
			const btn = document.getElementById('fixNavBtn');
			btn.style.display = 'block';
			switchTab('ai-fix-panel');

			document.getElementById('fixExplanation').innerText = 'Analyzing diagnostic error on ' + uri.split('/').pop() + '...';
			document.getElementById('solutionADesc').innerText = 'Calculating solution...';
			document.getElementById('solutionBDesc').innerText = 'Calculating solution...';
			document.getElementById('diffContainer').innerHTML = '<div class="diff-line">Running AI engine...</div>';

			vscode.postMessage({ command: 'fixWithAICommand', uri, marker });
		}

		function renderFixResult(data) {
			document.getElementById('fixExplanation').innerText = data.explanation;
			document.getElementById('solutionADesc').innerText = data.solutionA;
			document.getElementById('solutionBDesc').innerText = data.solutionB;

			const diffContainer = document.getElementById('diffContainer');
			diffContainer.innerHTML = '';
			const lines = data.patch.split('\\n');
			lines.forEach(l => {
				const div = document.createElement('div');
				div.className = 'diff-line';
				if (l.startsWith('+')) {
					div.classList.add('addition');
				} else if (l.startsWith('-')) {
					div.classList.add('deletion');
				}
				div.innerText = l;
				diffContainer.appendChild(div);
			});
		}
	</script>
</body>
</html>`;
	}
}
