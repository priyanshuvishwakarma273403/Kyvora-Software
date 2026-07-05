import { localize, localize2 } from '../../../../nls.js';
import { SyncDescriptor } from '../../../../platform/instantiation/common/descriptors.js';
import { InstantiationType, registerSingleton } from '../../../../platform/instantiation/common/extensions.js';
import { Registry } from '../../../../platform/registry/common/platform.js';
import { IViewContainersRegistry, IViewsRegistry, Extensions as ViewContainerExtensions, ViewContainerLocation } from '../../../common/views.js';
import { IKyvoraCollaborationService, KyvoraCollaborationService } from '../common/kyvoraCollaborationService.js';
import { kyvoraCollaborationViewIcon } from './kyvoraCollaborationIcons.js';
import { KYVORA_COLLABORATION_VIEW_CONTAINER_ID, KyvoraCollaborationViewPaneContainer } from './kyvoraCollaborationViewPaneContainer.js';
import { KyvoraCollaborationView } from './kyvoraCollaborationView.js';
import { ConfigurationScope, Extensions as ConfigurationExtensions, IConfigurationRegistry } from '../../../../platform/configuration/common/configurationRegistry.js';
import { workbenchConfigurationNodeBase } from '../../../common/configuration.js';

// ---- Register the DI Service ----
registerSingleton(IKyvoraCollaborationService, KyvoraCollaborationService, InstantiationType.Delayed);

// ---- Register the View Container (sidebar icon) ----
const kyvoraCollaborationViewContainer = Registry.as<IViewContainersRegistry>(ViewContainerExtensions.ViewContainersRegistry).registerViewContainer({
	id: KYVORA_COLLABORATION_VIEW_CONTAINER_ID,
	title: localize2('kyvoraCollaboration', 'Kyvora Collaboration'),
	ctorDescriptor: new SyncDescriptor(KyvoraCollaborationViewPaneContainer),
	icon: kyvoraCollaborationViewIcon,
	alwaysUseContainerInfo: true,
	order: 9,
	openCommandActionDescriptor: {
		id: KYVORA_COLLABORATION_VIEW_CONTAINER_ID,
		mnemonicTitle: localize({ key: 'miViewKyvoraCollaboration', comment: ['&& denotes a mnemonic'] }, "Kyvora &&Collaboration"),
		order: 9,
	},
	hideIfEmpty: false,
}, ViewContainerLocation.AuxiliaryBar);

// ---- Register Views inside the container ----
const viewsRegistry = Registry.as<IViewsRegistry>(ViewContainerExtensions.ViewsRegistry);

viewsRegistry.registerViews([{
	id: 'kyvora.collaborationOverview',
	name: localize2('kyvoraCollaboration.overview', 'Collaboration Hub'),
	containerIcon: kyvoraCollaborationViewIcon,
	ctorDescriptor: new SyncDescriptor(KyvoraCollaborationView),
	canToggleVisibility: false,
	canMoveView: false,
	order: 1
}], kyvoraCollaborationViewContainer);

// ---- Register Configuration Settings ----
const configurationRegistry = Registry.as<IConfigurationRegistry>(ConfigurationExtensions.Configuration);
configurationRegistry.registerConfiguration({
	...workbenchConfigurationNodeBase,
	properties: {
		'kyvora.collaboration.serverUrl': {
			scope: ConfigurationScope.APPLICATION,
			type: 'string',
			default: 'http://localhost:8080',
			description: localize('kyvora.collaboration.serverUrl', "The URL of the Kyvora Collaboration backend server.")
		}
	}
});
