import { IKyvoraAgentService } from '../common/kyvoraAgentService.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';

/**
 * Agent Hub Panel — orchestrates communication between the webview UI
 * and the backend KyvoraAgentService.
 *
 * This class is kept as a utility bridge. The actual UI registration happens
 * via the ViewPaneContainer in kyvoraAgents.contribution.ts.
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
			console.log('[Kyvora Agent Hub] Plan updated:', plan.taskId);
			if (this._webview) {
				this._webview.postMessage({ type: 'planUpdated', plan });
			}
			this.telemetryService.publicLog('kyvora.planUpdated', {
				taskId: plan.taskId
			});
		}));

		this._register(this.agentService.onAgentStatusChanged((data) => {
			console.log(`[Kyvora Agent Hub] Agent ${data.agentId}: ${data.status}`);
			if (this._webview) {
				this._webview.postMessage({ type: 'agentStatus', data });
			}
			this.telemetryService.publicLog('kyvora.agentStatus', {
				agentId: data.agentId,
				status: data.status
			});
		}));

		this._register(this.agentService.onMessageReceived((msg) => {
			console.log(`[Kyvora Agent Hub] ${msg.from} → ${msg.to}: ${msg.type}`);
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
			console.log(`[Kyvora Agent Hub] CONFLICT on ${conflict.filePath} between ${conflict.agent1Id} and ${conflict.agent2Id}`);
			this.telemetryService.publicLog('kyvora.conflictDetected', {
				filePath: conflict.filePath
			});
		}));

		this._register(this.agentService.onPipelineUpdated((pipeline) => {
			console.log(`[Kyvora Agent Hub] Pipeline "${pipeline.name}": ${pipeline.status}`);
			this.telemetryService.publicLog('kyvora.pipelineUpdated', {
				pipelineName: pipeline.name,
				status: pipeline.status
			});
		}));
	}

	async startTask(prompt: string): Promise<void> {
		const plan = await this.agentService.createPlan(prompt);
		console.log(`[Kyvora Agent Hub] Plan created with ${plan.subtasks.length} subtasks`);
		await this.agentService.executePlan();
	}

	/**
	 * Returns the HTML content for a webview-based rendering of the Agent Hub.
	 */
	getHtmlContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Kyvora Agent Hub</title>
	<style>
		:root {
			--bg-deepest: #0d0d0f;
			--bg-panel: #111114;
			--bg-hover: #1a1a1e;
			--bg-accent: #1e1826;
			--border-subtle: #1e1e22;
			--border-panel: #2a2a2e;
			--accent-primary: #a98de8;
			--accent-bright: #c8b4f0;
			--accent-text: #d4c4f8;
			--accent-dim: #7f6cc0;
			--text-primary: #e0d8f0;
			--text-secondary: #999;
			--text-muted: #555;
			--text-very-muted: #3a3a3d;
			--green-muted: #a8d8a8;
			--orange-soft: #e89c6a;
			--blue-soft: #82cfff;
		}

		* { box-sizing: border-box; margin: 0; padding: 0; }

		body {
			background-color: var(--bg-deepest);
			color: var(--text-primary);
			font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
			padding: 12px;
			display: flex;
			flex-direction: column;
			height: 100vh;
			overflow: hidden;
		}

		.header {
			display: flex;
			align-items: center;
			gap: 8px;
			margin-bottom: 12px;
			padding-bottom: 8px;
			border-bottom: 1px solid var(--border-subtle);
		}

		.header h2 {
			color: var(--accent-bright);
			font-size: 14px;
			font-weight: 600;
			letter-spacing: 0.3px;
		}

		.header .badge {
			background: var(--accent-dim);
			color: var(--text-primary);
			font-size: 10px;
			padding: 2px 6px;
			border-radius: 10px;
			font-weight: 500;
		}

		.task-input-area {
			display: flex;
			gap: 6px;
			margin-bottom: 12px;
		}

		.task-input-area textarea {
			flex: 1;
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 4px;
			color: var(--text-primary);
			padding: 8px;
			font-size: 12px;
			resize: none;
			min-height: 36px;
			max-height: 80px;
			font-family: inherit;
			transition: border-color 0.2s;
		}

		.task-input-area textarea:focus {
			outline: none;
			border-color: var(--accent-primary);
			box-shadow: 0 0 0 1px var(--accent-primary);
		}

		.task-input-area button {
			background: linear-gradient(135deg, var(--accent-dim), var(--accent-primary));
			border: none;
			color: white;
			padding: 8px 14px;
			border-radius: 4px;
			cursor: pointer;
			font-weight: 600;
			font-size: 11px;
			letter-spacing: 0.3px;
			transition: all 0.2s;
			white-space: nowrap;
		}

		.task-input-area button:hover {
			background: linear-gradient(135deg, var(--accent-primary), var(--accent-bright));
			transform: translateY(-1px);
		}

		.workspace-grid {
			display: grid;
			grid-template-columns: 160px 1fr;
			gap: 8px;
			flex: 1;
			min-height: 0;
			overflow: hidden;
		}

		.panel {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			border-radius: 6px;
			padding: 8px;
			overflow-y: auto;
		}

		.panel-title {
			font-size: 11px;
			font-weight: 600;
			color: var(--accent-text);
			text-transform: uppercase;
			letter-spacing: 0.8px;
			margin-bottom: 8px;
		}

		.agent-item {
			padding: 4px 6px;
			border-radius: 3px;
			margin-bottom: 4px;
			font-size: 11px;
			display: flex;
			align-items: center;
			gap: 6px;
			transition: background 0.15s;
		}

		.agent-item:hover {
			background: var(--bg-hover);
		}

		.agent-item.working {
			background: var(--bg-accent);
			border-left: 2px solid var(--accent-primary);
		}

		.agent-item.idle { color: var(--text-muted); }

		.agent-dot {
			width: 6px;
			height: 6px;
			border-radius: 50%;
			flex-shrink: 0;
		}

		.agent-dot.idle { background: var(--text-very-muted); }
		.agent-dot.working { background: var(--accent-primary); animation: pulse 1.5s infinite; }
		.agent-dot.completed { background: var(--green-muted); }
		.agent-dot.error { background: var(--orange-soft); }

		@keyframes pulse {
			0%, 100% { opacity: 1; }
			50% { opacity: 0.4; }
		}

		.subtask-item {
			padding: 6px 8px;
			border: 1px solid var(--border-subtle);
			border-radius: 4px;
			margin-bottom: 6px;
			background: var(--bg-deepest);
			transition: all 0.2s;
		}

		.subtask-item.completed { border-color: var(--green-muted); }
		.subtask-item.running { border-color: var(--accent-primary); background: var(--bg-accent); }
		.subtask-item.failed { border-color: var(--orange-soft); }

		.subtask-title {
			font-size: 11px;
			font-weight: 500;
			color: var(--text-primary);
		}

		.subtask-agent {
			font-size: 10px;
			color: var(--blue-soft);
		}

		.subtask-status {
			font-size: 9px;
			color: var(--text-muted);
			margin-top: 2px;
		}

		.live-feed {
			background: var(--bg-panel);
			border: 1px solid var(--border-subtle);
			padding: 8px;
			height: 100px;
			overflow-y: auto;
			font-family: 'Cascadia Code', 'Fira Code', monospace;
			font-size: 10px;
			margin-top: 8px;
			border-radius: 6px;
			color: var(--text-muted);
		}

		.live-feed div {
			padding: 1px 0;
			border-bottom: 1px solid var(--border-subtle);
		}

		.live-feed .msg-type { color: var(--accent-dim); }
		.live-feed .msg-agent { color: var(--blue-soft); }
	</style>
</head>
<body>
	<div class="header">
		<h2>⬡ KYVORA AGENT HUB</h2>
		<span class="badge">MULTI-AGENT</span>
	</div>

	<div class="task-input-area">
		<textarea id="taskInput" placeholder="Describe your task... (e.g. Add JWT authentication with refresh tokens)"></textarea>
		<button id="runBtn">▶ RUN</button>
	</div>

	<div class="workspace-grid">
		<div class="panel" id="agentList">
			<div class="panel-title">Agents</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Orchestrator</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Architect</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Coder</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Reviewer</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Tester</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Debugger</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Security</div>
			<div class="agent-item idle"><span class="agent-dot idle"></span>Searcher</div>
		</div>
		<div class="panel" id="planContainer">
			<div class="panel-title">Execution Plan</div>
			<p style="color: var(--text-very-muted); font-size: 11px;">No plan active. Enter a task to begin.</p>
		</div>
	</div>

	<div class="live-feed" id="liveFeed">
		<div><span class="msg-type">[SYS]</span> Kyvora Agent Hub initialized. Ready for tasks.</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();
		const runBtn = document.getElementById('runBtn');
		const taskInput = document.getElementById('taskInput');
		const planContainer = document.getElementById('planContainer');
		const liveFeed = document.getElementById('liveFeed');
		const agentList = document.getElementById('agentList');

		runBtn.addEventListener('click', () => {
			const prompt = taskInput.value.trim();
			if (prompt) {
				vscode.postMessage({ command: 'startTask', prompt: prompt });
				logFeed('SYS', 'Initializing multi-agent collaboration...');
			}
		});

		window.addEventListener('message', (event) => {
			const data = event.data;
			switch (data.type) {
				case 'planUpdated':
					renderPlan(data.plan);
					break;
				case 'agentStatus':
					updateAgentStatus(data.data);
					break;
				case 'busMessage':
					logFeed(data.msg.from, data.msg.type + ' → ' + data.msg.to);
					break;
			}
		});

		function logFeed(agent, text) {
			const div = document.createElement('div');
			div.innerHTML = '<span class="msg-agent">[' + agent + ']</span> <span class="msg-type">' + text + '</span>';
			liveFeed.appendChild(div);
			liveFeed.scrollTop = liveFeed.scrollHeight;
		}

		function renderPlan(plan) {
			let html = '<div class="panel-title">Execution Plan</div>';
			plan.subtasks.forEach((task) => {
				html += '<div class="subtask-item ' + task.status + '">';
				html += '<div class="subtask-title">' + task.title + '</div>';
				html += '<div class="subtask-agent">↳ ' + task.assignedAgent + '</div>';
				html += '<div class="subtask-status">Status: ' + task.status + '</div>';
				html += '</div>';
			});
			planContainer.innerHTML = html;
		}

		function updateAgentStatus(data) {
			const items = agentList.querySelectorAll('.agent-item');
			items.forEach((item) => {
				if (item.textContent.toLowerCase().includes(data.agentId)) {
					const dot = item.querySelector('.agent-dot');
					item.className = 'agent-item working';
					if (dot) { dot.className = 'agent-dot working'; }
				}
			});
		}
	</script>
</body>
</html>`;
	}
}
