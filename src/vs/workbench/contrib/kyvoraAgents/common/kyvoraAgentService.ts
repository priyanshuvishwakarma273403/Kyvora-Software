/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { URI } from '../../../../base/common/uri.js';

import { AgentRegistry, AgentDefinition } from './agentRegistry.js';
import { MessageBus, AgentMessage } from './messageBus.js';
import { KyvoraSharedMemory } from './sharedMemory.js';
import { ConflictResolutionService, FileConflict } from './conflictResolution.js';
import { AgentAuditLogger, AuditEntry } from './auditLogger.js';
import { AutoReviewPipeline, AutoTestPipeline, CollaborationPipeline } from './collaborationProtocols.js';
import { Orchestrator, TaskPlan } from '../agents/orchestrator.js';

/**
 * Main Kyvora Agents Service Interface — used for DI throughout the workbench.
 */
export const IKyvoraAgentService = createDecorator<IKyvoraAgentService>('kyvoraAgentService');

export interface IKyvoraAgentService {
	readonly _serviceBrand: undefined;

	// Events
	readonly onPlanCreated: Event<TaskPlan>;
	readonly onPlanUpdated: Event<TaskPlan>;
	readonly onAgentStatusChanged: Event<{ agentId: string; status: string }>;
	readonly onMessageReceived: Event<AgentMessage>;
	readonly onConflictDetected: Event<FileConflict>;
	readonly onPipelineUpdated: Event<CollaborationPipeline>;
	readonly onAuditEntry: Event<AuditEntry>;

	// Agent Registry
	getRegisteredAgents(): AgentDefinition[];
	getAgent(id: string): AgentDefinition | undefined;

	// Orchestration
	createPlan(request: string): Promise<TaskPlan>;
	executePlan(): Promise<void>;
	getCurrentPlan(): TaskPlan | null;

	// Conflict Resolution
	resolveConflict(conflictId: string, strategy: string): FileConflict | undefined;
	getPendingConflicts(): FileConflict[];

	// Audit
	getAuditEntries(filter?: { agentId?: string; sessionId?: string; limit?: number }): AuditEntry[];
	getSecurityReport(sessionId: string): any;
	generateHtmlSecurityReport(sessionId: string): string;

	// Lifecycle
	dispose(): void;
}

/**
 * Concrete implementation of the IKyvoraAgentService.
 * Wires together Registry, Bus, Memory, Orchestrator, Conflict Resolution,
 * Audit Logger, and Collaboration Pipelines into a single unified service.
 */
export class KyvoraAgentService extends Disposable implements IKyvoraAgentService {
	declare readonly _serviceBrand: undefined;

	// Core components
	private readonly registry: AgentRegistry;
	private readonly bus: MessageBus;
	private readonly memory: KyvoraSharedMemory;
	private readonly orchestrator: Orchestrator;
	private readonly conflictService: ConflictResolutionService;
	private readonly auditLogger: AgentAuditLogger;
	private readonly reviewPipeline: AutoReviewPipeline;
	private readonly testPipeline: AutoTestPipeline;

	// Events
	private readonly _onPlanCreated = this._register(new Emitter<TaskPlan>());
	readonly onPlanCreated: Event<TaskPlan> = this._onPlanCreated.event;

	private readonly _onPlanUpdated = this._register(new Emitter<TaskPlan>());
	readonly onPlanUpdated: Event<TaskPlan> = this._onPlanUpdated.event;

	private readonly _onAgentStatusChanged = this._register(new Emitter<{ agentId: string; status: string }>());
	readonly onAgentStatusChanged: Event<{ agentId: string; status: string }> = this._onAgentStatusChanged.event;

	private readonly _onMessageReceived = this._register(new Emitter<AgentMessage>());
	readonly onMessageReceived: Event<AgentMessage> = this._onMessageReceived.event;

	private readonly _onConflictDetected = this._register(new Emitter<FileConflict>());
	readonly onConflictDetected: Event<FileConflict> = this._onConflictDetected.event;

	private readonly _onPipelineUpdated = this._register(new Emitter<CollaborationPipeline>());
	readonly onPipelineUpdated: Event<CollaborationPipeline> = this._onPipelineUpdated.event;

	private readonly _onAuditEntry = this._register(new Emitter<AuditEntry>());
	readonly onAuditEntry: Event<AuditEntry> = this._onAuditEntry.event;

	private currentPlan: TaskPlan | null = null;

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		const rootFsPath = rootUri.fsPath;

		// Initialize core components
		this.registry = new AgentRegistry();
		this.bus = this._register(new MessageBus(rootUri, this.fileService));
		this.memory = new KyvoraSharedMemory(this.storageService);
		this.orchestrator = this._register(new Orchestrator(this.registry, this.bus, this.memory, rootFsPath, this.fileService));
		this.conflictService = this._register(new ConflictResolutionService());
		this.auditLogger = new AgentAuditLogger(rootUri, this.fileService);

		// Initialize collaboration pipelines
		this.reviewPipeline = this._register(new AutoReviewPipeline(this.bus, this.memory));
		this.testPipeline = this._register(new AutoTestPipeline(this.bus, this.memory));

		// Wire events
		this.wireEvents();
	}

	private wireEvents(): void {
		// Orchestrator events → Service events
		this._register(this.orchestrator.onPlanUpdated((plan: TaskPlan) => {
			this.currentPlan = plan;
			this._onPlanUpdated.fire(plan);
		}));

		this._register(this.orchestrator.onAgentStatusUpdated((data: { agentId: string; status: string }) => {
			this._onAgentStatusChanged.fire(data);
		}));

		// Bus events → Service events
		this._register(this.bus.onMessage((msg: AgentMessage) => {
			this._onMessageReceived.fire(msg);
		}));

		// Conflict events → Service events
		this._register(this.conflictService.onConflictDetected(conflict => {
			this._onConflictDetected.fire(conflict);
			this.auditLogger.log({
				sessionId: 'current',
				agentId: conflict.agent1Id,
				action: 'CONFLICT_DETECTED',
				details: `Conflict on ${conflict.filePath} between ${conflict.agent1Id} and ${conflict.agent2Id}`,
				severity: 'warning',
				filePath: conflict.filePath,
				outcome: 'blocked'
			});
		}));

		// Pipeline events → Service events
		this._register(this.reviewPipeline.onPipelineUpdated(pipeline => {
			this._onPipelineUpdated.fire(pipeline);
		}));

		this._register(this.testPipeline.onPipelineUpdated(pipeline => {
			this._onPipelineUpdated.fire(pipeline);
		}));
	}

	// --- Public API ---

	getRegisteredAgents(): AgentDefinition[] {
		return this.registry.getAllAgents();
	}

	getAgent(id: string): AgentDefinition | undefined {
		return this.registry.getAgent(id);
	}

	async createPlan(request: string): Promise<TaskPlan> {
		const plan = await this.orchestrator.createPlan(request);
		this.currentPlan = plan;
		this._onPlanCreated.fire(plan);

		this.auditLogger.log({
			sessionId: 'current',
			agentId: 'orchestrator',
			action: 'PLAN_CREATED',
			details: `Plan created for: ${request}`,
			severity: 'info',
			outcome: 'success'
		});

		return plan;
	}

	async executePlan(): Promise<void> {
		if (!this.currentPlan) { return; }

		this.auditLogger.log({
			sessionId: 'current',
			agentId: 'orchestrator',
			action: 'PLAN_EXECUTION_START',
			details: `Starting execution of plan: ${this.currentPlan.taskId}`,
			severity: 'info',
			outcome: 'success'
		});

		await this.orchestrator.executePlan();
	}

	getCurrentPlan(): TaskPlan | null {
		return this.currentPlan;
	}

	resolveConflict(conflictId: string, strategy: string): FileConflict | undefined {
		return this.conflictService.resolveConflict(conflictId, strategy as any);
	}

	getPendingConflicts(): FileConflict[] {
		return this.conflictService.getPendingConflicts();
	}

	getAuditEntries(filter?: { agentId?: string; sessionId?: string; limit?: number }): AuditEntry[] {
		return this.auditLogger.getEntries(filter);
	}

	getSecurityReport(sessionId: string): any {
		return this.auditLogger.getSecurityReport(sessionId);
	}

	generateHtmlSecurityReport(sessionId: string): string {
		return this.auditLogger.generateHtmlSecurityReport(sessionId);
	}
}
