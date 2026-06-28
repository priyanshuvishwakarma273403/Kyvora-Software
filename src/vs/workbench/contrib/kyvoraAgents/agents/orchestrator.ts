/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { AgentRegistry } from '../common/agentRegistry.js';
import { MessageBus, AgentMessage } from '../common/messageBus.js';
import { SharedMemory } from '../common/sharedMemory.js';
import { AgentWorker } from '../worker/agentWorker.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IFileService } from '../../../../platform/files/common/files.js';

export interface Subtask {
	id: string;
	title: string;
	description: string;
	assignedAgent: string;
	dependencies: string[];        // must complete before this starts
	status: 'pending' | 'running' | 'completed' | 'failed' | 'blocked';
	estimatedTokens: number;
	successCriteria: string[];
	rollbackPlan: string;
	humanApprovalRequired: boolean;
}

export interface TaskPlan {
	originalRequest: string;
	taskId: string;
	subtasks: Subtask[];
	dependencyGraph: Map<string, string[]>;
	estimatedDuration: string;
	requiredAgents: string[];
	riskFactors: string[];
}

export interface ResourceBudget {
	maxTokensPerSession: number;
	tokensUsed: number;
	tokensPerAgent: Map<string, number>;
	maxConcurrentAgents: number;
	activeAgents: string[];
	queuedTasks: Subtask[];
}

export class Orchestrator extends Disposable {
	private readonly _onPlanUpdated = this._register(new Emitter<TaskPlan>());
	readonly onPlanUpdated: Event<TaskPlan> = this._onPlanUpdated.event;

	private readonly _onAgentStatusUpdated = this._register(new Emitter<{ agentId: string; status: string }>());
	readonly onAgentStatusUpdated: Event<{ agentId: string; status: string }> = this._onAgentStatusUpdated.event;

	private currentPlan: TaskPlan | null = null;
	private budget: ResourceBudget;
	private activeWorkers = new Map<string, AgentWorker>();
	private sessionId: string = '';

	constructor(
		private readonly registry: AgentRegistry,
		private readonly bus: MessageBus,
		private readonly memory: SharedMemory,
		private readonly workspaceRoot: string,
		private readonly fileService: IFileService
	) {
		super();
		this.budget = {
			maxTokensPerSession: 500000,
			tokensUsed: 0,
			tokensPerAgent: new Map<string, number>(),
			maxConcurrentAgents: 4,
			activeAgents: [],
			queuedTasks: []
		};
		this.registerListeners();
	}

	private registerListeners(): void {
		this._register(this.bus.onMessage((message: AgentMessage) => {
			this.handleIncomingMessage(message);
		}));
	}

	private handleIncomingMessage(message: AgentMessage): void {
		if (message.to !== 'orchestrator' && message.to !== 'broadcast') return;

		switch (message.type) {
			case 'STATUS_UPDATE':
				this._onAgentStatusUpdated.fire({
					agentId: message.from,
					status: message.payload.description
				});
				break;
			case 'TASK_COMPLETE':
				this.handleTaskSuccess(message);
				break;
			case 'TASK_FAILED':
				this.handleTaskFailure(message);
				break;
			case 'TASK_BLOCKED':
				this.handleTaskBlocked(message);
				break;
		}
	}

	async createPlan(request: string): Promise<TaskPlan> {
		this.sessionId = Math.random().toString(36).substring(2, 15);
		const taskId = Math.random().toString(36).substring(2, 15);

		// Dynamic Plan Decomposition logic based on request
		const subtasks: Subtask[] = [];

		if (request.toLowerCase().includes('auth') || request.toLowerCase().includes('login')) {
			subtasks.push({
				id: 'task-1',
				title: 'Audit existing authentication codebase',
				description: 'Find any existing users or tokens modules.',
				assignedAgent: 'searcher',
				dependencies: [],
				status: 'pending',
				estimatedTokens: 15000,
				successCriteria: ['Identify UserService and auth models'],
				rollbackPlan: 'None needed',
				humanApprovalRequired: false
			});
			subtasks.push({
				id: 'task-2',
				title: 'Design authentication system',
				description: 'Create architectural design schemas for OAuth2.',
				assignedAgent: 'architect',
				dependencies: ['task-1'],
				status: 'pending',
				estimatedTokens: 25000,
				successCriteria: ['Produce authentication architecture ADR file'],
				rollbackPlan: 'Discard ADR',
				humanApprovalRequired: true
			});
			subtasks.push({
				id: 'task-3',
				title: 'Implement authentication files',
				description: 'Write auth.ts and controllers.',
				assignedAgent: 'coder',
				dependencies: ['task-2'],
				status: 'pending',
				estimatedTokens: 60000,
				successCriteria: ['Code matches project structure', 'Zero typescript errors'],
				rollbackPlan: 'Rollback modified files',
				humanApprovalRequired: false
			});
			subtasks.push({
				id: 'task-4',
				title: 'Write and run test cases',
				description: 'Write auth.test.ts unit tests and run execution.',
				assignedAgent: 'tester',
				dependencies: ['task-3'],
				status: 'pending',
				estimatedTokens: 30000,
				successCriteria: ['Test suite runs and matches 100% success'],
				rollbackPlan: 'Delete test files',
				humanApprovalRequired: false
			});
		} else {
			// Generic plan
			subtasks.push({
				id: 'task-1',
				title: 'Analyze codebase patterns',
				description: 'Search for standard design structure related to request.',
				assignedAgent: 'searcher',
				dependencies: [],
				status: 'pending',
				estimatedTokens: 10000,
				successCriteria: ['Code references located'],
				rollbackPlan: 'None',
				humanApprovalRequired: false
			});
			subtasks.push({
				id: 'task-2',
				title: 'Write implementation',
				description: 'Create or modify workspace files.',
				assignedAgent: 'coder',
				dependencies: ['task-1'],
				status: 'pending',
				estimatedTokens: 40000,
				successCriteria: ['Code written matching coding rules'],
				rollbackPlan: 'Revert edits',
				humanApprovalRequired: false
			});
		}

		const depGraph = new Map<string, string[]>();
		subtasks.forEach(t => depGraph.set(t.id, t.dependencies));

		const plan: TaskPlan = {
			originalRequest: request,
			taskId,
			subtasks,
			dependencyGraph: depGraph,
			estimatedDuration: `${subtasks.length * 2} minutes`,
			requiredAgents: Array.from(new Set(subtasks.map(s => s.assignedAgent))),
			riskFactors: request.toLowerCase().includes('auth') ? ['Security compliance', 'Secret variables leakage'] : ['Code stability']
		};

		this.currentPlan = plan;
		this._onPlanUpdated.fire(plan);
		return plan;
	}

	async executePlan(): Promise<void> {
		if (!this.currentPlan) return;

		this.initializeAgentWorkers();
		this.dispatchReadyTasks();
	}

	private initializeAgentWorkers(): void {
		if (!this.currentPlan) return;
		for (const agentId of this.currentPlan.requiredAgents) {
			if (!this.activeWorkers.has(agentId)) {
				const def = this.registry.getAgent(agentId);
				if (def) {
					const worker = new AgentWorker(def, this.bus, this.memory, this.workspaceRoot, this.fileService);
					this.activeWorkers.set(agentId, worker);
					worker.start(this.sessionId);
				}
			}
		}
	}

	private dispatchReadyTasks(): void {
		if (!this.currentPlan) return;

		for (const subtask of this.currentPlan.subtasks) {
			if (subtask.status !== 'pending') continue;

			// Check dependencies
			const dependenciesMet = subtask.dependencies.every(depId => {
				const depTask = this.currentPlan!.subtasks.find(t => t.id === depId);
				return depTask && depTask.status === 'completed';
			});

			if (dependenciesMet) {
				// Check concurrency limits
				if (this.budget.activeAgents.length >= this.budget.maxConcurrentAgents) {
					subtask.status = 'pending';
					continue;
				}

				this.runSubtask(subtask);
			}
		}
	}

	private runSubtask(subtask: Subtask): void {
		subtask.status = 'running';
		this.budget.activeAgents.push(subtask.assignedAgent);
		this._onPlanUpdated.fire(this.currentPlan!);

		this.bus.send({
			id: Math.random().toString(36).substring(2, 15),
			from: 'orchestrator',
			to: subtask.assignedAgent,
			type: 'TASK_ASSIGN',
			priority: 'high',
			payload: {
				subtaskId: subtask.id,
				title: subtask.title,
				description: subtask.description
			},
			timestamp: Date.now(),
			requiresReply: true
		});
	}

	private handleTaskSuccess(message: AgentMessage): void {
		if (!this.currentPlan) return;
		const subtask = this.currentPlan.subtasks.find(t => t.id === message.correlationId || t.status === 'running' && t.assignedAgent === message.from);
		if (subtask) {
			subtask.status = 'completed';
			this.budget.activeAgents = this.budget.activeAgents.filter(a => a !== message.from);
			this._onPlanUpdated.fire(this.currentPlan);
			this.dispatchReadyTasks();
		}
	}

	private handleTaskFailure(message: AgentMessage): void {
		if (!this.currentPlan) return;
		const subtask = this.currentPlan.subtasks.find(t => t.status === 'running' && t.assignedAgent === message.from);
		if (subtask) {
			subtask.status = 'failed';
			this.budget.activeAgents = this.budget.activeAgents.filter(a => a !== message.from);

			// Dynamic Re-planning: Try routing to Debugger if coder failed
			if (subtask.assignedAgent === 'coder') {
				subtask.assignedAgent = 'debugger';
				subtask.status = 'pending';
				subtask.description = `Fix coding error reported: ${message.payload.error}`;
				this.dispatchReadyTasks();
			} else {
				this._onPlanUpdated.fire(this.currentPlan);
			}
		}
	}

	private handleTaskBlocked(message: AgentMessage): void {
		if (!this.currentPlan) return;
		const subtask = this.currentPlan.subtasks.find(t => t.status === 'running' && t.assignedAgent === message.from);
		if (subtask) {
			subtask.status = 'blocked';
			this._onPlanUpdated.fire(this.currentPlan);
		}
	}

	override dispose(): void {
		for (const worker of this.activeWorkers.values()) {
			worker.stop();
		}
		this.activeWorkers.clear();
		super.dispose();
	}
}
