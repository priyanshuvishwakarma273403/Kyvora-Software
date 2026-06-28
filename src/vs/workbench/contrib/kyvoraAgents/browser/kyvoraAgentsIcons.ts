/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const kyvoraAgentsViewIcon = registerIcon('kyvora-agents-view-icon', Codicon.hubot, 'Icon for the Kyvora Agents view container.');
export const kyvoraAgentRunningIcon = registerIcon('kyvora-agent-running', Codicon.loading, 'Icon shown when a Kyvora agent is running.');
export const kyvoraAgentIdleIcon = registerIcon('kyvora-agent-idle', Codicon.circle, 'Icon shown when a Kyvora agent is idle.');
export const kyvoraAgentErrorIcon = registerIcon('kyvora-agent-error', Codicon.error, 'Icon shown when a Kyvora agent has an error.');
export const kyvoraPlanIcon = registerIcon('kyvora-plan', Codicon.listOrdered, 'Icon for a Kyvora task plan.');
export const kyvoraSubtaskIcon = registerIcon('kyvora-subtask', Codicon.play, 'Icon for a Kyvora subtask.');
export const kyvoraConflictIcon = registerIcon('kyvora-conflict', Codicon.warning, 'Icon for a Kyvora conflict.');
