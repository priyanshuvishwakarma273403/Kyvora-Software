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
import { CollaborationPanel } from './collaborationPanel.js';
import { getWindow } from '../../../../base/browser/dom.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';

export class KyvoraCollaborationView extends ViewPane {
	private webview: IWebviewElement | undefined;
	private collaborationPanel: CollaborationPanel | undefined;
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
		@IWebviewService private readonly webviewService: IWebviewService
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

		this.collaborationPanel = this._register(this.instantiationService.createInstance(CollaborationPanel));

		this.buildWebview();
	}

	private buildWebview(): void {
		this.webviewDisposables.clear();

		if (!this.container || !this.collaborationPanel) {
			return;
		}

		// Create webview element
		this.webview = this.webviewDisposables.add(this.webviewService.createWebviewElement({
			title: 'Kyvora Collaboration Hub',
			options: { purpose: undefined },
			contentOptions: { allowScripts: true },
			extension: undefined
		}));

		this.webview.mountTo(this.container, getWindow(this.container));

		this.webviewDisposables.add(this.webview.onMessage(async e => {
			await this.collaborationPanel?.handleMessage(e.message);
		}));

		// Initial display
		this.webview.setHtml(this.collaborationPanel.getHtmlContent());
		this.collaborationPanel.setWebview(this.webview);
	}

	protected override layoutBody(height: number, width: number): void {
		super.layoutBody(height, width);
	}
}
