import { Disposable } from '../../../../base/common/lifecycle.js';

export class AdvancedPanel extends Disposable {
	constructor() {
		super();
	}

	public getHtmlContent(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<title>Kyvora Advanced Hub</title>
	<style>
		:root {
			--bg-deep: #08080a;
			--bg-card: rgba(13, 13, 16, 0.7);
			--border-subtle: rgba(255, 255, 255, 0.05);
			--text-main: #e2e8f0;
			--text-muted: #94a3b8;
			--primary-glow: #8b5cf6;
			--secondary-glow: #06b6d4;
			--terminal-bg: #050507;
		}

		body {
			background-color: var(--bg-deep);
			color: var(--text-main);
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			margin: 0;
			padding: 12px;
			user-select: none;
			overflow-x: hidden;
		}

		/* Tab Navigation */
		.tabs-container {
			display: flex;
			gap: 4px;
			padding: 4px;
			background: var(--border-subtle);
			border-radius: 8px;
			margin-bottom: 16px;
			overflow-x: auto;
		}

		.tab-button {
			background: transparent;
			border: none;
			color: var(--text-muted);
			padding: 8px 12px;
			font-size: 11px;
			font-weight: 600;
			border-radius: 6px;
			cursor: pointer;
			white-space: nowrap;
			transition: all 0.2s ease;
			display: flex;
			align-items: center;
			gap: 6px;
		}

		.tab-button:hover {
			color: var(--text-main);
			background: rgba(255, 255, 255, 0.02);
		}

		.tab-button.active {
			color: #fff;
			background: rgba(139, 92, 246, 0.2);
			box-shadow: inset 0 0 8px rgba(139, 92, 246, 0.15);
		}

		/* Tab Content */
		.tab-content {
			display: none;
			animation: fadeIn 0.3s ease;
		}

		.tab-content.active {
			display: block;
		}

		@keyframes fadeIn {
			from { opacity: 0; transform: translateY(4px); }
			to { opacity: 1; transform: translateY(0); }
		}

		/* Glassmorphic Cards */
		.card {
			background: var(--bg-card);
			border: 1px solid var(--border-subtle);
			border-radius: 12px;
			padding: 16px;
			margin-bottom: 12px;
			backdrop-filter: blur(12px);
		}

		.card-title {
			font-size: 13px;
			font-weight: 700;
			margin-bottom: 12px;
			color: #fff;
			text-transform: uppercase;
			letter-spacing: 0.5px;
			display: flex;
			align-items: center;
			gap: 8px;
		}

		.description {
			font-size: 11px;
			color: var(--text-muted);
			line-height: 1.5;
			margin-bottom: 14px;
		}

		/* Feature 1: CodeSphere */
		#canvasContainer {
			width: 100%;
			height: 300px;
			background: #040406;
			border-radius: 8px;
			position: relative;
			overflow: hidden;
			border: 1px solid var(--border-subtle);
		}

		#visualizerCanvas {
			width: 100%;
			height: 100%;
			cursor: grab;
		}

		.canvas-hint {
			position: absolute;
			bottom: 8px;
			left: 8px;
			font-size: 9px;
			color: var(--text-muted);
			background: rgba(0,0,0,0.6);
			padding: 2px 6px;
			border-radius: 4px;
		}

		/* Feature 2: Chronos */
		.timeline-control {
			display: flex;
			align-items: center;
			gap: 12px;
			margin-bottom: 16px;
		}

		.slider-bar {
			flex-grow: 1;
			-webkit-appearance: none;
			height: 4px;
			border-radius: 2px;
			background: var(--border-subtle);
			outline: none;
		}

		.slider-bar::-webkit-slider-thumb {
			-webkit-appearance: none;
			width: 12px;
			height: 12px;
			border-radius: 50%;
			background: var(--primary-glow);
			cursor: pointer;
			box-shadow: 0 0 8px var(--primary-glow);
		}

		.btn {
			background: rgba(255, 255, 255, 0.05);
			border: 1px solid var(--border-subtle);
			color: #fff;
			padding: 6px 12px;
			border-radius: 6px;
			font-size: 11px;
			cursor: pointer;
			transition: all 0.2s ease;
		}

		.btn:hover {
			background: rgba(255, 255, 255, 0.1);
			border-color: rgba(255,255,255,0.2);
		}

		.btn-primary {
			background: var(--primary-glow);
			border: none;
		}

		.btn-primary:hover {
			opacity: 0.9;
		}

		.chronos-log {
			background: var(--terminal-bg);
			border-radius: 8px;
			padding: 12px;
			font-family: monospace;
			font-size: 11px;
			max-height: 180px;
			overflow-y: auto;
			border: 1px solid var(--border-subtle);
		}

		.log-entry {
			margin-bottom: 6px;
			line-height: 1.4;
		}

		.log-info { color: #51afef; }
		.log-warn { color: #da8548; }
		.log-error { color: #ff6c6b; }

		/* Feature 3: Playground */
		.playground-editor {
			width: 100%;
			height: 120px;
			background: var(--terminal-bg);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			color: #a9a1e1;
			font-family: monospace;
			font-size: 11px;
			padding: 8px;
			resize: none;
			box-sizing: border-box;
			outline: none;
			margin-bottom: 8px;
		}

		.playground-output {
			background: var(--terminal-bg);
			border-radius: 8px;
			padding: 8px;
			font-family: monospace;
			font-size: 10px;
			height: 100px;
			overflow-y: auto;
			border: 1px solid var(--border-subtle);
			color: #98be65;
		}

		/* Feature 4: VocalCode */
		.voice-status {
			display: flex;
			align-items: center;
			gap: 8px;
			font-size: 11px;
			font-weight: 600;
			margin-bottom: 12px;
		}

		.voice-status-dot {
			width: 8px;
			height: 8px;
			border-radius: 50%;
			background: #ff6c6b;
		}

		.voice-status-dot.active {
			background: #98be65;
			box-shadow: 0 0 8px #98be65;
			animation: pulse 1.2s infinite;
		}

		@keyframes pulse {
			0% { transform: scale(1); opacity: 1; }
			50% { transform: scale(1.2); opacity: 0.6; }
			100% { transform: scale(1); opacity: 1; }
		}

		.voice-bubble {
			background: rgba(255, 255, 255, 0.03);
			border: 1px solid var(--border-subtle);
			border-radius: 8px;
			padding: 10px;
			font-size: 11px;
			min-height: 40px;
			font-style: italic;
			color: var(--text-main);
			margin-bottom: 12px;
		}

		.voice-hints {
			display: flex;
			flex-direction: column;
			gap: 6px;
		}

		.voice-hint-item {
			font-size: 10px;
			color: var(--text-muted);
			background: rgba(255, 255, 255, 0.02);
			padding: 6px;
			border-radius: 4px;
			border: 1px solid var(--border-subtle);
			cursor: pointer;
			transition: all 0.2s ease;
		}

		.voice-hint-item:hover {
			background: rgba(255, 255, 255, 0.05);
			color: #fff;
		}

		/* Feature 5: Sync Board */
		#syncBoardContainer {
			width: 100%;
			height: 320px;
			background: #070709;
			border-radius: 8px;
			position: relative;
			border: 1px solid var(--border-subtle);
			overflow: hidden;
		}

		.sync-node {
			position: absolute;
			background: rgba(20, 20, 25, 0.9);
			border: 1px solid var(--primary-glow);
			border-radius: 6px;
			padding: 6px 10px;
			font-size: 10px;
			color: #fff;
			cursor: move;
			box-shadow: 0 4px 12px rgba(0,0,0,0.5);
			z-index: 10;
		}

		.sync-node:hover {
			border-color: var(--secondary-glow);
			box-shadow: 0 0 8px rgba(6, 182, 212, 0.4);
		}

		.sync-node-title {
			font-weight: 700;
			margin-bottom: 2px;
			pointer-events: none;
		}

		.sync-node-meta {
			font-size: 8px;
			color: var(--text-muted);
			pointer-events: none;
		}

		#syncBoardControls {
			position: absolute;
			top: 8px;
			left: 8px;
			display: flex;
			gap: 6px;
			z-index: 20;
		}
	</style>
</head>
<body>

	<!-- Tabs Navigation -->
	<div class="tabs-container">
		<button class="tab-button active" onclick="switchTab('codesphere')">CodeSphere</button>
		<button class="tab-button" onclick="switchTab('chronos')">Chronos</button>
		<button class="tab-button" onclick="switchTab('playground')">Playground</button>
		<button class="tab-button" onclick="switchTab('vocalcode')">VocalCode</button>
		<button class="tab-button" onclick="switchTab('syncboard')">Sync Board</button>
	</div>

	<!-- CodeSphere Content -->
	<div id="codesphere" class="tab-content active">
		<div class="card">
			<div class="card-title">CodeSphere 3D Visualizer</div>
			<div class="description">
				Map and browse files in 3D coordinate space. Double-click nodes to open the file instantly in the editor.
			</div>
			<div id="canvasContainer">
				<canvas id="visualizerCanvas"></canvas>
				<div class="canvas-hint">Drag to rotate. Scroll to zoom. Double-click file node to open.</div>
			</div>
		</div>
	</div>

	<!-- Chronos Content -->
	<div id="chronos" class="tab-content">
		<div class="card">
			<div class="card-title">Chronos Debugger</div>
			<div class="description">
				Step back in time to inspect call logs and memory state. Hot-fix variable values directly.
			</div>
			
			<div class="timeline-control">
				<button class="btn" onclick="adjustTick(-1)">Step Back</button>
				<input type="range" min="1" max="5" value="1" class="slider-bar" id="tickSlider" oninput="onSliderChange(this.value)">
				<button class="btn" onclick="adjustTick(1)">Step Forward</button>
			</div>

			<div class="card" style="background: rgba(0,0,0,0.2); padding: 12px; margin-bottom: 12px;">
				<div style="font-size: 11px; font-weight: bold; margin-bottom: 6px; color: var(--secondary-glow);">Variable Stack Inspector (Tick <span id="currentTickSpan">1</span>)</div>
				<div style="display: flex; flex-direction: column; gap: 6px; font-family: monospace; font-size: 11px;">
					<div style="display: flex; justify-content: space-between;">
						<span>activeConnections:</span>
						<input type="number" id="connectionsVar" value="5" style="background: transparent; border: none; border-bottom: 1px solid var(--border-subtle); color: #fff; text-align: right; width: 60px; outline: none;" onchange="updateVariable()">
					</div>
					<div style="display: flex; justify-content: space-between;">
						<span>databaseConnected:</span>
						<span id="dbConnectedVar" style="color: #98be65;">true</span>
					</div>
					<div style="display: flex; justify-content: space-between;">
						<span>status:</span>
						<span id="statusVar" style="color: #a9a1e1;">"OK"</span>
					</div>
				</div>
			</div>

			<div class="chronos-log" id="chronosLog">
				<div class="log-entry log-info">[19:40:01] System boot complete. Initialized Chronos memory buffer.</div>
				<div class="log-entry log-info">[19:40:02] Tick 1: Listening for requests on port 8080.</div>
			</div>
		</div>
	</div>

	<!-- Playground Content -->
	<div id="playground" class="tab-content">
		<div class="card">
			<div class="card-title">Sandboxed Playground</div>
			<div class="description">
				Write and test isolated algorithms. Output renders instantly in the terminal panel below.
			</div>
			<textarea class="playground-editor" id="codeEditor">/**
 * Sample playground function
 */
function calculateFibonacci(n) {
  let arr = [0, 1];
  for (let i = 2; i <= n; i++) {
    arr.push(arr[i - 1] + arr[i - 2]);
  }
  return arr.slice(0, n);
}

console.log("Fibonacci sequence:", calculateFibonacci(10));
</textarea>
			<div style="display: flex; gap: 8px; margin-bottom: 12px;">
				<button class="btn btn-primary" onclick="runPlaygroundCode()">Run Sandbox Code</button>
				<button class="btn" onclick="exportPlaygroundCode()">Export to File</button>
			</div>
			<div class="playground-output" id="playgroundOutput">> Click 'Run Sandbox Code' to execute.</div>
		</div>
	</div>

	<!-- VocalCode Content -->
	<div id="vocalcode" class="tab-content">
		<div class="card">
			<div class="card-title">VocalCode Speech Engine</div>
			<div class="description">
				Speak AST-based instructions to navigate the workspace, refactor files, or query helper systems hands-free.
			</div>

			<div class="voice-status">
				<div class="voice-status-dot" id="voiceDot"></div>
				<span id="voiceStatusText">Voice engine ready</span>
			</div>

			<div class="voice-bubble" id="speechTranscript">"Click the button and say a command..."</div>

			<div style="margin-bottom: 16px;">
				<button class="btn btn-primary" id="micBtn" onclick="toggleSpeech()">Activate Microphone</button>
			</div>

			<div class="voice-hints">
				<div style="font-size: 10px; font-weight: bold; margin-bottom: 4px; color: var(--text-muted);">Available Voice Actions</div>
				<div class="voice-hint-item" onclick="simulateVoice('search rate-limiter')">"search rate-limiter" - Runs global codebase search</div>
				<div class="voice-hint-item" onclick="simulateVoice('open auth.ts')">"open auth.ts" - Opens matching workspace file</div>
				<div class="voice-hint-item" onclick="simulateVoice('create helper.js')">"create helper.js" - Generates file in project root</div>
				<div class="voice-hint-item" onclick="simulateVoice('explain')">"explain" - Explains active editor selections</div>
				<div class="voice-hint-item" onclick="simulateVoice('theme')">"theme" - Brings up the editor theme picker</div>
			</div>
		</div>
	</div>

	<!-- Sync Board Content -->
	<div id="syncboard" class="tab-content">
		<div class="card">
			<div class="card-title">Visual Architecture Sync Board</div>
			<div class="description">
				Design visual class layout structures. Double-click boxes to open bound files in the editor.
			</div>

			<div id="syncBoardContainer">
				<div id="syncBoardControls">
					<button class="btn" onclick="addNewBoardNode()" style="padding: 4px 8px; font-size: 9px;">+ Add Class</button>
				</div>
				<!-- Default nodes -->
				<div class="sync-node" style="top: 80px; left: 40px;" onmousedown="dragNode(event, this)" ondblclick="openNodeFile('auth.ts')">
					<div class="sync-node-title">auth.ts</div>
					<div class="sync-node-meta">Class: Authenticator</div>
				</div>
				<div class="sync-node" style="top: 180px; left: 160px;" onmousedown="dragNode(event, this)" ondblclick="openNodeFile('db.ts')">
					<div class="sync-node-title">db.ts</div>
					<div class="sync-node-meta">Class: DBConnector</div>
				</div>
			</div>
		</div>
	</div>

	<script>
		const vscode = acquireVsCodeApi();

		// Switch Tabs
		function switchTab(tabId) {
			document.querySelectorAll('.tab-button').forEach(btn => btn.classList.remove('active'));
			document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));

			event.currentTarget.classList.add('active');
			document.getElementById(tabId).classList.add('active');

			if (tabId === 'codesphere') {
				loadWorkspaceFiles();
			}
		}

		// Feature 1: CodeSphere Canvas Render
		let canvas = document.getElementById('visualizerCanvas');
		let ctx = canvas.getContext('2d');
		let nodes = [];
		let angleX = 0.005;
		let angleY = 0.005;

		function loadWorkspaceFiles() {
			vscode.postMessage({ command: 'getWorkspaceFiles' });
		}

		window.addEventListener('message', event => {
			const message = event.data;
			if (message.command === 'workspaceFilesData') {
				initCodeSphere(message.files);
			}
		});

		function initCodeSphere(files) {
			canvas.width = canvas.parentElement.clientWidth;
			canvas.height = canvas.parentElement.clientHeight;

			nodes = [];
			const fileList = files && files.length > 0 ? files : [
				{ name: 'auth.ts', path: 'auth.ts' },
				{ name: 'db.ts', path: 'db.ts' },
				{ name: 'app.ts', path: 'app.ts' },
				{ name: 'server.ts', path: 'server.ts' }
			];

			fileList.forEach((f, idx) => {
				const theta = Math.acos(Math.random() * 2 - 1);
				const phi = Math.random() * Math.PI * 2;
				const radius = 100;

				nodes.push({
					name: f.name,
					path: f.path,
					x3d: radius * Math.sin(theta) * Math.cos(phi),
					y3d: radius * Math.sin(theta) * Math.sin(phi),
					z3d: radius * Math.cos(theta),
					x: 0,
					y: 0,
					screenSize: 0
				});
			});

			animateCodeSphere();
		}

		function rotate3D() {
			const cosX = Math.cos(angleX);
			const sinX = Math.sin(angleX);
			const cosY = Math.cos(angleY);
			const sinY = Math.sin(angleY);

			nodes.forEach(n => {
				// Rotate Y
				let x1 = n.x3d * cosY - n.z3d * sinY;
				let z1 = n.z3d * cosY + n.x3d * sinY;

				// Rotate X
				let y1 = n.y3d * cosX - z1 * sinX;
				let z2 = z1 * cosX + n.y3d * sinX;

				n.x3d = x1;
				n.y3d = y1;
				n.z3d = z2;

				// Perspective Projection
				const fov = 200;
				const distance = 250;
				const scale = fov / (distance + n.z3d);

				n.x = (canvas.width / 2) + n.x3d * scale;
				n.y = (canvas.height / 2) + n.y3d * scale;
				n.screenSize = Math.max(2, scale * 6);
			});
		}

		function drawCodeSphere() {
			ctx.clearRect(0, 0, canvas.width, canvas.height);
			
			// Draw Connections
			ctx.strokeStyle = 'rgba(139, 92, 246, 0.1)';
			ctx.lineWidth = 0.5;
			for (let i = 0; i < nodes.length; i++) {
				for (let j = i + 1; j < nodes.length; j++) {
					if (Math.abs(nodes[i].z3d - nodes[j].z3d) < 80) {
						ctx.beginPath();
						ctx.moveTo(nodes[i].x, nodes[i].y);
						ctx.lineTo(nodes[j].x, nodes[j].y);
						ctx.stroke();
					}
				}
			}

			// Draw Node Spheres
			nodes.forEach(n => {
				const alpha = (n.z3d + 100) / 200; // depth shading
				ctx.fillStyle = \`rgba(6, 182, 212, \${alpha})\`;
				ctx.beginPath();
				ctx.arc(n.x, n.y, n.screenSize, 0, Math.PI * 2);
				ctx.fill();

				// Label
				if (alpha > 0.4) {
					ctx.fillStyle = \`rgba(255, 255, 255, \${alpha})\`;
					ctx.font = '8px monospace';
					ctx.fillText(n.name, n.x + 8, n.y + 2);
				}
			});
		}

		let visualizerAnimationId;
		function animateCodeSphere() {
			rotate3D();
			drawCodeSphere();
			visualizerAnimationId = requestAnimationFrame(animateCodeSphere);
		}

		// Double click canvas to open
		canvas.addEventListener('dblclick', e => {
			const rect = canvas.getBoundingClientRect();
			const mouseX = e.clientX - rect.left;
			const mouseY = e.clientY - rect.top;

			nodes.forEach(n => {
				const dist = Math.hypot(n.x - mouseX, n.y - mouseY);
				if (dist < n.screenSize + 6) {
					vscode.postMessage({ command: 'openFile', path: n.path });
				}
			});
		});

		// Mouse drag to rotate
		let isDragging = false;
		let prevMouseX = 0;
		let prevMouseY = 0;

		canvas.addEventListener('mousedown', e => {
			isDragging = true;
			prevMouseX = e.clientX;
			prevMouseY = e.clientY;
		});

		window.addEventListener('mouseup', () => { isDragging = false; });

		canvas.addEventListener('mousemove', e => {
			if (!isDragging) return;
			const deltaX = e.clientX - prevMouseX;
			const deltaY = e.clientY - prevMouseY;

			angleY = deltaX * 0.005;
			angleX = -deltaY * 0.005;

			prevMouseX = e.clientX;
			prevMouseY = e.clientY;
		});

		// Initial load
		initCodeSphere();

		// Feature 2: Chronos Debugger simulation
		const ticksData = {
			1: { connections: 5, db: 'true', status: 'OK', log: 'Tick 1: Listening for requests on port 8080.\\nDatabase status: CONNECTED' },
			2: { connections: 14, db: 'true', status: 'OK', log: 'Tick 2: Ingress rate spike. 14 socket descriptors open.\\nMemory footprint normal.' },
			3: { connections: 38, db: 'true', status: 'OK', log: 'Tick 3: Connection Pool warning. 38 active sockets.\\nDB latency rising.' },
			4: { connections: 50, db: 'false', status: 'CRITICAL', log: 'Tick 4: Database server connection lost!\\nActive sockets: 50. Entering failover state.' },
			5: { connections: 0, db: 'false', status: 'CRASHED', log: 'Tick 5: Core execution context crashed: DB_TIMEOUT_ERR.\\nStack frame dumped.' }
		};

		function onSliderChange(tick) {
			document.getElementById('currentTickSpan').textContent = tick;
			const data = ticksData[tick];
			document.getElementById('connectionsVar').value = data.connections;
			document.getElementById('dbConnectedVar').textContent = data.db;
			document.getElementById('dbConnectedVar').style.color = data.db === 'true' ? '#98be65' : '#ff6c6b';
			document.getElementById('statusVar').textContent = '"' + data.status + '"';
			document.getElementById('statusVar').style.color = data.status === 'OK' ? '#a9a1e1' : '#ff6c6b';

			// Add log
			const logBox = document.getElementById('chronosLog');
			const levelClass = data.status === 'OK' ? 'log-info' : (data.status === 'CRITICAL' ? 'log-warn' : 'log-error');
			logBox.innerHTML += \`<div class="log-entry \${levelClass}">\${data.log}</div>\`;
			logBox.scrollTop = logBox.scrollHeight;
		}

		function adjustTick(amount) {
			const slider = document.getElementById('tickSlider');
			let val = parseInt(slider.value) + amount;
			val = Math.max(1, Math.min(5, val));
			slider.value = val;
			onSliderChange(val);
		}

		function updateVariable() {
			const conn = parseInt(document.getElementById('connectionsVar').value);
			const logBox = document.getElementById('chronosLog');
			logBox.innerHTML += \`<div class="log-entry log-warn">Chronos Hot-swap: Set connections limit to \${conn}. Simulating recovery...</div>\`;
			if (conn < 40) {
				logBox.innerHTML += \`<div class="log-entry log-info">System returned to stable condition. Connection pool recovered successfully.</div>\`;
			}
			logBox.scrollTop = logBox.scrollHeight;
		}

		// Feature 3: Playground
		function runPlaygroundCode() {
			const code = document.getElementById('codeEditor').value;
			const outputBox = document.getElementById('playgroundOutput');
			outputBox.innerHTML = '';

			// Capture console.log
			const logs = [];
			const originalLog = console.log;
			console.log = function(...args) {
				logs.push(args.map(a => typeof a === 'object' ? JSON.stringify(a) : a).join(' '));
			};

			try {
				const result = new Function(code)();
				console.log = originalLog;
				outputBox.innerHTML = logs.map(l => '> ' + l).join('<br>') + (result !== undefined ? '<br>Returned: ' + result : '');
			} catch (e) {
				console.log = originalLog;
				outputBox.innerHTML = '<span style="color: #ff6c6b;">Exception: ' + e.message + '</span>';
			}
		}

		function exportPlaygroundCode() {
			const code = document.getElementById('codeEditor').value;
			vscode.postMessage({ command: 'createSandboxFile', name: 'playground_code.js', content: code });
		}

		// Feature 4: VocalCode Speech Recognition
		let recognition;
		let isListening = false;

		if ('webkitSpeechRecognition' in window) {
			recognition = new webkitSpeechRecognition();
			recognition.continuous = false;
			recognition.interimResults = false;
			recognition.lang = 'en-US';

			recognition.onstart = function() {
				isListening = true;
				document.getElementById('voiceDot').classList.add('active');
				document.getElementById('voiceStatusText').textContent = 'Listening...';
				document.getElementById('micBtn').textContent = 'Deactivate Microphone';
			};

			recognition.onend = function() {
				isListening = false;
				document.getElementById('voiceDot').classList.remove('active');
				document.getElementById('voiceStatusText').textContent = 'Speech engine ready';
				document.getElementById('micBtn').textContent = 'Activate Microphone';
			};

			recognition.onresult = function(event) {
				const transcript = event.results[0][0].transcript.trim();
				document.getElementById('speechTranscript').textContent = '"' + transcript + '"';
				processVoiceText(transcript);
			};
		}

		function toggleSpeech() {
			if (!recognition) {
				alert('Speech recognition is not supported in this environment.');
				return;
			}
			if (isListening) {
				recognition.stop();
			} else {
				recognition.start();
			}
		}

		function simulateVoice(text) {
			document.getElementById('speechTranscript').textContent = '"' + text + '"';
			processVoiceText(text);
		}

		function processVoiceText(text) {
			const lower = text.toLowerCase();
			if (lower.startsWith('search ')) {
				const query = lower.replace('search ', '');
				vscode.postMessage({ command: 'voiceCommand', action: 'search', value: query });
			} else if (lower.startsWith('open ')) {
				const filename = lower.replace('open ', '');
				vscode.postMessage({ command: 'voiceCommand', action: 'open', value: filename });
			} else if (lower.startsWith('create ')) {
				const filename = lower.replace('create ', '');
				vscode.postMessage({ command: 'voiceCommand', action: 'create', value: filename });
			} else if (lower === 'close all') {
				vscode.postMessage({ command: 'voiceCommand', action: 'closeAll' });
			} else if (lower === 'theme') {
				vscode.postMessage({ command: 'voiceCommand', action: 'theme' });
			} else if (lower === 'explain') {
				vscode.postMessage({ command: 'voiceCommand', action: 'explain' });
			}
		}

		// Feature 5: Sync Board Whiteboard
		function dragNode(e, node) {
			e.preventDefault();
			let pos1 = 0, pos2 = 0, pos3 = e.clientX, pos4 = e.clientY;
			
			document.onmouseup = () => {
				document.onmouseup = null;
				document.onmousemove = null;
			};

			document.onmousemove = (e) => {
				e.preventDefault();
				pos1 = pos3 - e.clientX;
				pos2 = pos4 - e.clientY;
				pos3 = e.clientX;
				pos4 = e.clientY;

				node.style.top = Math.max(0, node.offsetTop - pos2) + "px";
				node.style.left = Math.max(0, node.offsetLeft - pos1) + "px";
			};
		}

		function openNodeFile(path) {
			vscode.postMessage({ command: 'openFile', path: path });
		}

		function addNewBoardNode() {
			const name = prompt('Enter bound file name:', 'helper.ts');
			if (!name) return;
			const container = document.getElementById('syncBoardContainer');
			const node = document.createElement('div');
			node.className = 'sync-node';
			node.style.top = '100px';
			node.style.left = '100px';
			node.onmousedown = (e) => dragNode(e, node);
			node.ondblclick = () => openNodeFile(name);

			node.innerHTML = \`
				<div class="sync-node-title">\${name}</div>
				<div class="sync-node-meta">Class: CustomNode</div>
			\`;
			container.appendChild(node);
		}
	</script>
</body>
</html>`;
	}
}
