/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export type MessageType =
	| 'TASK_ASSIGN'
	| 'TASK_COMPLETE'
	| 'TASK_FAILED'
	| 'TASK_BLOCKED'
	| 'FINDING_REPORT'
	| 'CODE_PRODUCED'
	| 'REVIEW_REQUESTED'
	| 'REVIEW_COMPLETE'
	| 'TEST_REQUESTED'
	| 'TEST_RESULT'
	| 'MEMORY_STORE'
	| 'MEMORY_QUERY'
	| 'FILE_MODIFIED'
	| 'AGENT_SPAWN_REQUEST'
	| 'AGENT_KILLED'
	| 'STATUS_UPDATE'
	| 'HUMAN_INPUT_NEEDED'
	| 'CONFLICT_DETECTED'
	| 'HANDOFF';

export interface AgentMessage {
	id: string;                    // unique message ID
	correlationId?: string;        // links replies to original message
	from: string;                  // sender agent ID
	to: string | 'broadcast';      // recipient agent ID or broadcast to all
	type: MessageType;
	priority: 'low' | 'normal' | 'high' | 'critical';
	payload: any;
	timestamp: number;
	requiresReply: boolean;
	replyDeadlineMs?: number;      // deadline in ms
}

export class MessageBus extends Disposable {
	private readonly _onMessage = this._register(new Emitter<AgentMessage>());
	readonly onMessage: Event<AgentMessage> = this._onMessage.event;

	private readonly messageQueue = new Map<string, AgentMessage[]>(); // recipientId -> messages
	private readonly activeRecipients = new Set<string>();
	private readonly logFileUri: URI;
	private readonly messageNodes = new Map<string, { message: AgentMessage; replies: string[] }>();

	constructor(
		workspaceRootUri: URI,
		private readonly fileService: IFileService
	) {
		super();
		this.logFileUri = URI.joinPath(workspaceRootUri, '.kyvora', 'agents', 'message-log.jsonl');
	}

	private async logMessage(message: AgentMessage): Promise<void> {
		try {
			const entry = JSON.stringify(message) + '\n';
			await this.fileService.writeFile(
				this.logFileUri,
				VSBuffer.fromString(entry),
				{ unlock: true, append: true }
			);
		} catch (e) {
			console.error('Failed to log message to bus log:', e);
		}
	}

	registerAgent(agentId: string): void {
		this.activeRecipients.add(agentId);
		this.processQueue(agentId);
	}

	unregisterAgent(agentId: string): void {
		this.activeRecipients.delete(agentId);
	}

	send(message: AgentMessage): void {
		// Store in DAG
		this.messageNodes.set(message.id, { message, replies: [] });
		if (message.correlationId && this.messageNodes.has(message.correlationId)) {
			this.messageNodes.get(message.correlationId)!.replies.push(message.id);
		}

		this.logMessage(message);

		if (message.to === 'broadcast') {
			this._onMessage.fire(message);
			// Queue/deliver for all active recipients
			for (const recipient of this.activeRecipients) {
				if (recipient !== message.from) {
					this.queueMessage(recipient, message);
				}
			}
		} else {
			this.queueMessage(message.to, message);
		}
	}

	private queueMessage(recipientId: string, message: AgentMessage): void {
		if (this.activeRecipients.has(recipientId)) {
			this._onMessage.fire(message);
		} else {
			if (!this.messageQueue.has(recipientId)) {
				this.messageQueue.set(recipientId, []);
			}
			this.messageQueue.get(recipientId)!.push(message);
		}
	}

	private processQueue(recipientId: string): void {
		const queue = this.messageQueue.get(recipientId);
		if (queue && queue.length > 0) {
			this.messageQueue.set(recipientId, []);
			for (const message of queue) {
				this._onMessage.fire(message);
			}
		}
	}

	getMessageGraph(): { nodes: AgentMessage[]; edges: { from: string; to: string }[] } {
		const nodes: AgentMessage[] = [];
		const edges: { from: string; to: string }[] = [];

		for (const [id, node] of this.messageNodes.entries()) {
			nodes.push(node.message);
			for (const replyId of node.replies) {
				edges.push({ from: id, to: replyId });
			}
		}

		return { nodes, edges };
	}
}
