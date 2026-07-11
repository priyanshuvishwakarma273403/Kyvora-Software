import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../../common/views.js';
import { kyvoraAdvancedViewIcon } from './kyvoraAdvancedIcons.js';
import { KYVORA_ADVANCED_VIEW_CONTAINER_ID, KyvoraAdvancedViewPaneContainer } from './kyvoraAdvancedViewPaneContainer.js';
import { KyvoraAdvancedView } from './kyvoraAdvancedView.js';
import { IWorkbenchContributionsRegistry, Extensions as WorkbenchExtensions } from '../../../common/contributions.js';
import { LifecyclePhase } from '../../../services/lifecycle/common/lifecycle.js';
import { KyvoraAutoAutomation } from './kyvoraAutoAutomation.js';

// ---- Register Background Automation Service ----
Registry.as<IWorkbenchContributionsRegistry>(WorkbenchExtensions.Workbench).registerWorkbenchContribution(
	KyvoraAutoAutomation,
	LifecyclePhase.Restored
);

// ---- Register the View Container (sidebar icon) ----
const kyvoraAdvancedViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: KYVORA_ADVANCED_VIEW_CONTAINER_ID,
	title: localize2('kyvoraAdvanced', 'Kyvora Advanced Hub'),
	ctorDescriptor: new SyncDescriptor(KyvoraAdvancedViewPaneContainer),
	icon: kyvoraAdvancedViewIcon,
	alwaysUseContainerInfo: true,
	order: 10,
	openCommandActionDescriptor: {
		id: KYVORA_ADVANCED_VIEW_CONTAINER_ID,
		mnemonicTitle: localize({ key: 'miViewKyvoraAdvanced', comment: ['&& denotes a mnemonic'] }, "Kyvora &&Advanced Hub"),
		order: 10,
	},
	hideIfEmpty: false,
}, ViewContainerLocation.Sidebar);

// ---- Register Views inside the container ----
const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

viewsRegistry.registerViews([{
	id: 'kyvora.advancedOverview',
	name: localize2('kyvoraAdvanced.overview', 'Kyvora Workstation Hub'),
	containerIcon: kyvoraAdvancedViewIcon,
	ctorDescriptor: new SyncDescriptor(KyvoraAdvancedView),
	canToggleVisibility: false,
	canMoveView: false,
	order: 1
}], kyvoraAdvancedViewContainer);
