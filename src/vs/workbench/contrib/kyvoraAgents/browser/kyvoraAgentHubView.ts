/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

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
import { IKyvoraAgentService } from '../common/kyvoraAgentService.js';
import { AgentHubPanel } from './agentHubPanel.js';
import { ITelemetryService } from '../../../../platform/telemetry/common/telemetry.js';
import { getWindow } from '../../../../base/browser/dom.js';

export class KyvoraAgentHubView extends ViewPane {
	private webview: IWebviewElement | undefined;
	private agentHubPanel: AgentHubPanel | undefined;
	private isStarted = false;

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
		@IKyvoraAgentService private readonly agentService: IKyvoraAgentService,
		@ITelemetryService private readonly telemetryService: ITelemetryService
	) {
		super(options, keybindingService, contextMenuService, configurationService, contextKeyService, viewDescriptorService, instantiationService, openerService, themeService, hoverService);
	}

	protected override renderBody(container: HTMLElement): void {
		super.renderBody(container);

		container.style.width = '100%';
		container.style.height = '100%';
		container.style.display = 'flex';
		container.style.flexDirection = 'column';

		// Create webview element
		this.webview = this._register(this.webviewService.createWebviewElement({
			title: 'Kyvora Agent Hub',
			options: { purpose: undefined },
			contentOptions: { allowScripts: true },
			extension: undefined
		}));

		this.webview.mountTo(container, getWindow(container));

		this.agentHubPanel = this._register(this.instantiationService.createInstance(AgentHubPanel));

		this._register(this.webview.onMessage(e => {
			if (e.message.command === 'startHub') {
				this.startHub();
			} else if (e.message.command === 'startTask') {
				this.agentHubPanel?.startTask(e.message.prompt);
			}
		}));

		// Initial display
		this.updateWebviewContent();
	}

	public startHub(): void {
		this.isStarted = true;
		this.updateWebviewContent();
	}

	private updateWebviewContent(): void {
		if (!this.webview || !this.agentHubPanel) { return; }

		if (!this.isStarted) {
			// Render welcome screen
			this.webview.setHtml(this.getWelcomeHtml());
		} else {
			// Render active panel
			this.webview.setHtml(this.agentHubPanel.getHtmlContent());
			this.agentHubPanel.setWebview(this.webview);
		}
	}

	private getWelcomeHtml(): string {
		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<meta name="viewport" content="width=device-width, initial-scale=1.0">
	<style>
		body {
			background-color: #0d0d0f;
			color: #e0d8f0;
			font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
			padding: 24px 16px;
			display: flex;
			flex-direction: column;
			align-items: center;
			justify-content: center;
			height: 100vh;
			margin: 0;
			box-sizing: border-box;
			text-align: center;
		}
		.logo-container {
			margin-bottom: 24px;
			animation: float 4s ease-in-out infinite;
		}
		@keyframes float {
			0%, 100% { transform: translateY(0px); }
			50% { transform: translateY(-10px); }
		}
		h2 {
			color: #c8b4f0;
			font-size: 18px;
			margin-bottom: 12px;
			letter-spacing: 0.5px;
		}
		p {
			color: #999;
			font-size: 13px;
			line-height: 1.6;
			margin-bottom: 24px;
			max-width: 280px;
		}
		button {
			background: linear-gradient(135deg, #7f6cc0, #a98de8);
			border: none;
			color: white;
			padding: 10px 20px;
			border-radius: 6px;
			cursor: pointer;
			font-weight: 600;
			font-size: 12px;
			letter-spacing: 0.5px;
			transition: all 0.2s;
		}
		button:hover {
			background: linear-gradient(135deg, #a98de8, #c8b4f0);
			transform: translateY(-1px);
			box-shadow: 0 4px 12px rgba(169, 141, 232, 0.3);
		}
	</style>
</head>
<body>
	<div class="logo-container">
		<svg width="64" height="64" viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg">
			<defs>
				<linearGradient id="kyvora-brand-grad" x1="0%" y1="0%" x2="100%" y2="100%">
					<stop offset="0%" stop-color="#8B5CF6" />
					<stop offset="50%" stop-color="#D946EF" />
					<stop offset="100%" stop-color="#06B6D4" />
				</linearGradient>
			</defs>
			<polygon points="50,12 83,31 83,69 50,88 17,69 17,31" stroke="url(#kyvora-brand-grad)" stroke-width="2.5" stroke-linejoin="round" fill="none" />
			<path d="M34 26 V74 M34 50 C 45 42, 58 35, 68 28 M34 50 C 48 55, 56 66, 68 72" stroke="url(#kyvora-brand-grad)" stroke-width="6" stroke-linecap="round" />
		</svg>
	</div>
	<h2>Kyvora Agents</h2>
	<p>The Kyvora Multi-Agent system is ready. Type a complex task and let specialized AI agents collaborate to solve it.</p>
	<button id="startBtn">Start Agent Hub</button>

	<script>
		const vscode = acquireVsCodeApi();
		document.getElementById('startBtn').addEventListener('click', () => {
			vscode.postMessage({ command: 'startHub' });
		});
	</script>
</body>
</html>`;
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
	}
}
