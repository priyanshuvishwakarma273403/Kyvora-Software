/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { MessageBus, AgentMessage } from './messageBus.js';
import { SharedMemory } from './sharedMemory.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';

/**
 * Defines a structured collaboration pipeline between agents.
 */
export interface CollaborationPipeline {
	id: string;
	name: string;
	stages: PipelineStage[];
	status: 'idle' | 'running' | 'completed' | 'failed';
	startedAt?: number;
	completedAt?: number;
}

export interface PipelineStage {
	id: string;
	name: string;
	agentId: string;
	status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
	input?: any;
	output?: any;
	duration?: number;
}

/**
 * Auto-Review Pipeline:
 * Coder writes code → Reviewer reviews → Security audits → Coder fixes (if needed)
 */
export class AutoReviewPipeline extends Disposable {

	private readonly _onPipelineUpdated = this._register(new Emitter<CollaborationPipeline>());
	readonly onPipelineUpdated: Event<CollaborationPipeline> = this._onPipelineUpdated.event;

	private currentPipeline: CollaborationPipeline | null = null;

	constructor(
		private readonly bus: MessageBus,
		private readonly memory: SharedMemory
	) {
		super();
		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.bus.onMessage((msg: AgentMessage) => {
			if (msg.type === 'CODE_PRODUCED') {
				this.triggerReview(msg);
			}
			if (msg.type === 'REVIEW_COMPLETE') {
				this.handleReviewResult(msg);
			}
		}));
	}

	/**
	 * Automatically trigger a code review when a Coder produces code.
	 */
	private triggerReview(coderMessage: AgentMessage): void {
		const pipelineId = `review-pipeline-${Date.now()}`;
		this.currentPipeline = {
			id: pipelineId,
			name: 'Auto Code Review',
			stages: [
				{ id: 'code', name: 'Code Production', agentId: 'coder', status: 'completed', output: coderMessage.payload },
				{ id: 'review', name: 'Code Review', agentId: 'reviewer', status: 'pending' },
				{ id: 'security', name: 'Security Audit', agentId: 'security', status: 'pending' },
				{ id: 'fix', name: 'Apply Fixes', agentId: 'coder', status: 'pending' }
			],
			status: 'running',
			startedAt: Date.now()
		};

		this._onPipelineUpdated.fire(this.currentPipeline);

		// Send review request to Reviewer
		this.bus.send({
			id: `review-req-${Date.now()}`,
			correlationId: coderMessage.id,
			from: 'orchestrator',
			to: 'reviewer',
			type: 'REVIEW_REQUESTED',
			priority: 'high',
			payload: {
				pipelineId,
				code: coderMessage.payload,
				reviewType: 'full'
			},
			timestamp: Date.now(),
			requiresReply: true
		});

		this.updateStageStatus('review', 'running');
	}

	/**
	 * Handle a completed review and route to security or back to coder.
	 */
	private handleReviewResult(reviewMessage: AgentMessage): void {
		if (!this.currentPipeline) { return; }

		this.updateStageStatus('review', 'completed', reviewMessage.payload);

		const hasIssues = reviewMessage.payload?.issues?.length > 0;

		if (hasIssues) {
			// Route to Security audit
			this.bus.send({
				id: `security-req-${Date.now()}`,
				correlationId: reviewMessage.id,
				from: 'orchestrator',
				to: 'security',
				type: 'TASK_ASSIGN',
				priority: 'high',
				payload: {
					pipelineId: this.currentPipeline.id,
					code: reviewMessage.payload.code,
					reviewFindings: reviewMessage.payload.issues,
					task: 'Audit the reviewed code for security vulnerabilities'
				},
				timestamp: Date.now(),
				requiresReply: true
			});
			this.updateStageStatus('security', 'running');
		} else {
			// Skip security, mark pipeline complete
			this.updateStageStatus('security', 'skipped');
			this.updateStageStatus('fix', 'skipped');
			this.completePipeline();
		}
	}

	private updateStageStatus(stageId: string, status: PipelineStage['status'], output?: any): void {
		if (!this.currentPipeline) { return; }

		const stage = this.currentPipeline.stages.find(s => s.id === stageId);
		if (stage) {
			stage.status = status;
			if (output) { stage.output = output; }
		}
		this._onPipelineUpdated.fire(this.currentPipeline);
	}

	private completePipeline(): void {
		if (!this.currentPipeline) { return; }
		this.currentPipeline.status = 'completed';
		this.currentPipeline.completedAt = Date.now();
		this._onPipelineUpdated.fire(this.currentPipeline);

		// Store completion in episodic memory
		this.memory.episodic.record({
			id: `event-${Date.now()}`,
			sessionId: 'current',
			agentId: 'orchestrator',
			timestamp: Date.now(),
			eventType: 'PIPELINE_COMPLETE',
			description: `Auto-review pipeline completed: ${this.currentPipeline.id}`
		});
	}
}

/**
 * Auto-Test Pipeline:
 * Coder writes code → Tester writes tests → Tests run → Report back
 */
export class AutoTestPipeline extends Disposable {

	private readonly _onPipelineUpdated = this._register(new Emitter<CollaborationPipeline>());
	readonly onPipelineUpdated: Event<CollaborationPipeline> = this._onPipelineUpdated.event;

	private currentPipeline: CollaborationPipeline | null = null;

	constructor(
		private readonly bus: MessageBus,
		private readonly memory: SharedMemory
	) {
		super();
		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.bus.onMessage((msg: AgentMessage) => {
			if (msg.type === 'CODE_PRODUCED' && msg.payload?.requestTests) {
				this.triggerTestGeneration(msg);
			}
			if (msg.type === 'TEST_RESULT') {
				this.handleTestResult(msg);
			}
		}));
	}

	private triggerTestGeneration(coderMessage: AgentMessage): void {
		const pipelineId = `test-pipeline-${Date.now()}`;
		this.currentPipeline = {
			id: pipelineId,
			name: 'Auto Test Generation',
			stages: [
				{ id: 'code', name: 'Code Production', agentId: 'coder', status: 'completed', output: coderMessage.payload },
				{ id: 'test_write', name: 'Write Tests', agentId: 'tester', status: 'pending' },
				{ id: 'test_run', name: 'Run Tests', agentId: 'tester', status: 'pending' },
				{ id: 'report', name: 'Report Results', agentId: 'orchestrator', status: 'pending' }
			],
			status: 'running',
			startedAt: Date.now()
		};

		this._onPipelineUpdated.fire(this.currentPipeline);

		this.bus.send({
			id: `test-req-${Date.now()}`,
			correlationId: coderMessage.id,
			from: 'orchestrator',
			to: 'tester',
			type: 'TEST_REQUESTED',
			priority: 'normal',
			payload: {
				pipelineId,
				code: coderMessage.payload,
				testType: 'unit'
			},
			timestamp: Date.now(),
			requiresReply: true
		});

		this.updateStageStatus('test_write', 'running');
	}

	private handleTestResult(testMessage: AgentMessage): void {
		if (!this.currentPipeline) { return; }

		this.updateStageStatus('test_write', 'completed');
		this.updateStageStatus('test_run', 'completed', testMessage.payload);
		this.updateStageStatus('report', 'completed');

		this.currentPipeline.status = 'completed';
		this.currentPipeline.completedAt = Date.now();
		this._onPipelineUpdated.fire(this.currentPipeline);

		// Record in memory
		this.memory.episodic.record({
			id: `event-${Date.now()}`,
			sessionId: 'current',
			agentId: 'tester',
			timestamp: Date.now(),
			eventType: 'TEST_PIPELINE_COMPLETE',
			description: `Test pipeline completed. Pass: ${testMessage.payload?.passed || 0}, Fail: ${testMessage.payload?.failed || 0}`
		});
	}

	private updateStageStatus(stageId: string, status: PipelineStage['status'], output?: any): void {
		if (!this.currentPipeline) { return; }
		const stage = this.currentPipeline.stages.find(s => s.id === stageId);
		if (stage) {
			stage.status = status;
			if (output) { stage.output = output; }
		}
		this._onPipelineUpdated.fire(this.currentPipeline);
	}
}

/**
 * Handoff Protocol:
 * Structured message pattern for passing work between agents with full context.
 */
export interface HandoffPayload {
	fromAgent: string;
	toAgent: string;
	reason: string;
	context: {
		filesModified: string[];
		filesRead: string[];
		decisions: string[];
		warnings: string[];
		memoryKeys: string[];
	};
	task: {
		title: string;
		description: string;
		constraints: string[];
	};
}

export class HandoffProtocol {

	constructor(private readonly bus: MessageBus) { }

	/**
	 * Create a structured handoff message between agents.
	 */
	createHandoff(payload: HandoffPayload): void {
		this.bus.send({
			id: `handoff-${Date.now()}`,
			from: payload.fromAgent,
			to: payload.toAgent,
			type: 'HANDOFF',
			priority: 'high',
			payload,
			timestamp: Date.now(),
			requiresReply: true
		});
	}

	/**
	 * Create a handoff from Architect → Coder with design decisions.
	 */
	architectToCoder(
		filesDesigned: string[],
		decisions: string[],
		task: string
	): void {
		this.createHandoff({
			fromAgent: 'architect',
			toAgent: 'coder',
			reason: 'Architecture design complete, ready for implementation',
			context: {
				filesModified: [],
				filesRead: filesDesigned,
				decisions,
				warnings: [],
				memoryKeys: ['architecture_adr']
			},
			task: {
				title: 'Implement Architecture',
				description: task,
				constraints: ['Follow ADR decisions', 'Match existing code style']
			}
		});
	}

	/**
	 * Create a handoff from Coder → Reviewer after implementation.
	 */
	coderToReviewer(
		filesModified: string[],
		description: string
	): void {
		this.createHandoff({
			fromAgent: 'coder',
			toAgent: 'reviewer',
			reason: 'Implementation complete, ready for code review',
			context: {
				filesModified,
				filesRead: [],
				decisions: [],
				warnings: [],
				memoryKeys: []
			},
			task: {
				title: 'Review Implementation',
				description,
				constraints: ['Check for bugs', 'Verify style compliance', 'Assess test coverage']
			}
		});
	}

	/**
	 * Create a handoff from Reviewer → Debugger if bugs are found.
	 */
	reviewerToDebugger(
		filesWithBugs: string[],
		bugDescriptions: string[]
	): void {
		this.createHandoff({
			fromAgent: 'reviewer',
			toAgent: 'debugger',
			reason: 'Bugs identified during code review',
			context: {
				filesModified: [],
				filesRead: filesWithBugs,
				decisions: [],
				warnings: bugDescriptions,
				memoryKeys: ['review_findings']
			},
			task: {
				title: 'Fix Reported Bugs',
				description: `Fix the following issues: ${bugDescriptions.join('; ')}`,
				constraints: ['Do not introduce new bugs', 'Maintain existing test coverage']
			}
		});
	}
}
