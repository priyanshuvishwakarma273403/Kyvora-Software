import { Codicon } from '../../../../base/common/codicons.js';
import { registerIcon } from '../../../../platform/theme/common/iconRegistry.js';

export const kyvoraCollaborationViewIcon = registerIcon('kyvora-collaboration-view-icon', Codicon.broadcast, 'Icon for the Kyvora Collaboration view container.');
export const kyvoraVoiceMutedIcon = registerIcon('kyvora-voice-muted', Codicon.mute, 'Icon shown when voice collaboration is muted.');
export const kyvoraVoiceActiveIcon = registerIcon('kyvora-voice-active', Codicon.unmute, 'Icon shown when voice collaboration is active.');
export const kyvoraSessionActiveIcon = registerIcon('kyvora-session-active', Codicon.circleFilled, 'Icon shown when a session is active.');
export const kyvoraSessionInactiveIcon = registerIcon('kyvora-session-inactive', Codicon.circleOutline, 'Icon shown when a session is inactive.');
export const kyvoraInviteIcon = registerIcon('kyvora-invite', Codicon.personAdd, 'Icon for invite user actions.');
export const kyvoraChatIcon = registerIcon('kyvora-chat', Codicon.commentDiscussion, 'Icon for live chat tab.');
