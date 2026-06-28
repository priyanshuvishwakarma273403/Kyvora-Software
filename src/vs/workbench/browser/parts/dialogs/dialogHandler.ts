/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize } from '../../../../nls.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { IConfirmation, IConfirmationResult, IInputResult, ICheckbox, IInputElement, ICustomDialogOptions, IInput, AbstractDialogHandler, DialogType, IPrompt, IAsyncPromptResult } from '../../../../platform/dialogs/common/dialogs.js';
import { ILayoutService } from '../../../../platform/layout/browser/layoutService.js';
import { ILogService } from '../../../../platform/log/common/log.js';
import Severity from '../../../../base/common/severity.js';
import { Dialog, IDialogResult } from '../../../../base/browser/ui/dialog/dialog.js';
import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { IKeybindingService } from '../../../../platform/keybinding/common/keybinding.js';
import { IClipboardService } from '../../../../platform/clipboard/common/clipboardService.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IMarkdownRendererService, openLinkFromMarkdown } from '../../../../platform/markdown/browser/markdownRenderer.js';
import { IOpenerService } from '../../../../platform/opener/common/opener.js';
import { createWorkbenchDialogOptions } from './dialog.js';
import { IHostService } from '../../../services/host/browser/host.js';

export class BrowserDialogHandler extends AbstractDialogHandler {

	private static readonly ALLOWABLE_COMMANDS = new Set([
		'copy',
		'cut',
		'editor.action.selectAll',
		'editor.action.clipboardCopyAction',
		'editor.action.clipboardCutAction',
		'editor.action.clipboardPasteAction'
	]);

	constructor(
		@ILogService private readonly logService: ILogService,
		@ILayoutService private readonly layoutService: ILayoutService,
		@IKeybindingService private readonly keybindingService: IKeybindingService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IClipboardService private readonly clipboardService: IClipboardService,
		@IOpenerService private readonly openerService: IOpenerService,
		@IMarkdownRendererService private readonly markdownRendererService: IMarkdownRendererService,
		@IHostService private readonly hostService: IHostService,
	) {
		super();
	}

	async prompt<T>(prompt: IPrompt<T>): Promise<IAsyncPromptResult<T>> {
		this.logService.trace('DialogService#prompt', prompt.message);

		const buttons = this.getPromptButtons(prompt);

		const { button, checkboxChecked } = await this.doShow(prompt.type, prompt.message, buttons, prompt.detail, prompt.cancelButton ? buttons.length - 1 : -1 /* Disabled */, prompt.checkbox, undefined, typeof prompt?.custom === 'object' ? prompt.custom : undefined, prompt.token);

		return this.getPromptResult(prompt, button, checkboxChecked);
	}

	async confirm(confirmation: IConfirmation): Promise<IConfirmationResult> {
		this.logService.trace('DialogService#confirm', confirmation.message);

		const buttons = this.getConfirmationButtons(confirmation);

		const { button, checkboxChecked } = await this.doShow(confirmation.type ?? 'question', confirmation.message, buttons, confirmation.detail, buttons.length - 1, confirmation.checkbox, undefined, typeof confirmation?.custom === 'object' ? confirmation.custom : undefined, confirmation.token);

		return { confirmed: button === 0, checkboxChecked };
	}

	async input(input: IInput): Promise<IInputResult> {
		this.logService.trace('DialogService#input', input.message);

		const buttons = this.getInputButtons(input);

		const { button, checkboxChecked, values } = await this.doShow(input.type ?? 'question', input.message, buttons, input.detail, buttons.length - 1, input?.checkbox, input.inputs, typeof input.custom === 'object' ? input.custom : undefined, input.token);

		return { confirmed: button === 0, checkboxChecked, values };
	}

	async about(title: string, details: string, detailsToCopy: string): Promise<void> {

		const { button } = await this.doShow(
			Severity.Info,
			title,
			[
				localize({ key: 'copy', comment: ['&& denotes a mnemonic'] }, "&&Copy"),
				localize('ok', "OK")
			],
			details,
			1
		);

		if (button === 0) {
			this.clipboardService.writeText(detailsToCopy);
		}
	}

	private async doShow(type: Severity | DialogType | undefined, message: string, buttons?: string[], detail?: string, cancelId?: number, checkbox?: ICheckbox, inputs?: IInputElement[], customOptions?: ICustomDialogOptions, token?: CancellationToken): Promise<IDialogResult> {
		const dialogDisposables = new DisposableStore();

		let renderBody = customOptions ? (parent: HTMLElement) => {
			parent.classList.add(...(customOptions.classes || []));
			customOptions.markdownDetails?.forEach(markdownDetail => {
				const result = dialogDisposables.add(this.markdownRendererService.render(markdownDetail.markdown, {
					actionHandler: markdownDetail.actionHandler || ((link, mdStr) => {
						return openLinkFromMarkdown(this.openerService, link, mdStr.isTrusted, true /* skip URL validation to prevent another dialog from showing which is unsupported */);
					}),
				}));
				parent.appendChild(result.element);
				result.element.classList.add(...(markdownDetail.classes || []));
			});
		} : undefined;

		if (!renderBody && (message.toLowerCase().includes('kyvora') || (detail && detail.toLowerCase().includes('kyvora')))) {
			renderBody = (parent: HTMLElement) => {
				const logoContainer = document.createElement('div');
				logoContainer.style.display = 'flex';
				logoContainer.style.justifyContent = 'center';
				logoContainer.style.marginBottom = '16px';
				logoContainer.innerHTML = `
					<svg width="64" height="74" viewBox="0 0 80 92" fill="none" xmlns="http://www.w3.org/2000/svg">
						<path d="M40 2L76.36 23V65L40 86L3.64 65V23L40 2Z" stroke="#a98de8" stroke-width="4" stroke-linejoin="round"/>
						<path d="M40 18L61.65 30.5V55.5L40 68L18.35 55.5V30.5L40 18Z" fill="#a98de8" fill-opacity="0.2" stroke="#a98de8" stroke-width="2" stroke-linejoin="round"/>
						<circle cx="40" cy="43" r="10" fill="#c8b4f0"/>
					</svg>
				`;
				parent.appendChild(logoContainer);
			};
		}

		const dialog = new Dialog(
			this.layoutService.activeContainer,
			message,
			buttons,
			createWorkbenchDialogOptions({
				detail,
				cancelId,
				type: this.getDialogType(type),
				renderBody,
				icon: customOptions?.icon,
				disableCloseAction: customOptions?.disableCloseAction,
				buttonOptions: customOptions?.buttonDetails?.map(detail => ({ sublabel: detail })),
				checkboxLabel: checkbox?.label,
				checkboxChecked: checkbox?.checked,
				inputs
			}, this.keybindingService, this.layoutService, this.hostService, BrowserDialogHandler.ALLOWABLE_COMMANDS)
		);

		dialogDisposables.add(dialog);

		if (token) {
			dialogDisposables.add(token.onCancellationRequested(() => dialogDisposables.dispose()));
		}

		const result = await dialog.show();
		dialogDisposables.dispose();

		return result;
	}
}
