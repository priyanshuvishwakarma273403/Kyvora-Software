/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../../common/views.js';
import { IKyvoraAgentService, KyvoraAgentService } from '../common/kyvoraAgentService.js';
import { kyvoraAgentsViewIcon } from './kyvoraAgentsIcons.js';
import { KYVORA_AGENTS_VIEW_CONTAINER_ID, KyvoraAgentsViewPaneContainer } from './kyvoraAgentsViewPaneContainer.js';
import { KyvoraAgentHubView } from './kyvoraAgentHubView.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { Action2, registerAction2 } from '../../../../platform/actions/common/actions.js';
import { ServicesAccessor } from '../../../../platform/instantiation/common/instantiation.js';

// ---- Register the DI Service ----
registerSingleton(IKyvoraAgentService, KyvoraAgentService, InstantiationType.Delayed);

// ---- Register the View Container (sidebar icon) ----
Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: KYVORA_AGENTS_VIEW_CONTAINER_ID,
	title: localize2('kyvoraAgents', 'Kyvora Agents'),
	ctorDescriptor: new SyncDescriptor(KyvoraAgentsViewPaneContainer),
	icon: kyvoraAgentsViewIcon,
	alwaysUseContainerInfo: true,
	order: 8,
	openCommandActionDescriptor: {
		id: KYVORA_AGENTS_VIEW_CONTAINER_ID,
		mnemonicTitle: localize({ key: 'miViewKyvoraAgents', comment: ['&& denotes a mnemonic'] }, "Kyvora &&Agents"),
		order: 8,
	},
	hideIfEmpty: false,
}, ViewContainerLocation.Sidebar);

// ---- Register Views inside the container ----
const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

viewsRegistry.registerViews([{
	id: 'kyvora.agentsOverview',
	name: localize2('kyvoraAgents.overview', 'Kyvora Agent Hub'),
	containerIcon: kyvoraAgentsViewIcon,
	ctorDescriptor: new SyncDescriptor(KyvoraAgentHubView),
	canToggleVisibility: false,
	canMoveView: false,
	order: 1
}], KYVORA_AGENTS_VIEW_CONTAINER_ID);

viewsRegistry.registerViewWelcomeContent('kyvora.agentsOverview', {
	content: localize('kyvoraAgents.welcome', "The Kyvora Multi-Agent system is ready.\n\nType a complex task and let specialized AI agents collaborate to solve it.\n\n[Start Agent Hub](command:kyvora.startAgentHub)"),
	order: 1
});

// ---- Register Commands ----
registerAction2(class extends Action2 {
	constructor() {
		super({
			id: 'kyvora.startAgentHub',
			title: localize2('kyvora.startAgentHub', 'Start Agent Hub'),
			f1: false
		});
	}

	run(accessor: ServicesAccessor): void {
		const viewsService = accessor.get(IViewsService);
		const view = viewsService.getActiveViewWithId<KyvoraAgentHubView>('kyvora.agentsOverview');
		if (view) {
			view.startHub();
		}
	}
});
