import { createDecorator } from '../../../../platform/instantiation/common/instantiation.js';
import { Disposable } from '../../../../base/common/lifecycle.js';
import { Emitter, Event } from '../../../../base/common/event.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

import { AgentRegistry, AgentDefinition } from './agentRegistry.js';
import { MessageBus, AgentMessage } from './messageBus.js';
import { KyvoraSharedMemory } from './sharedMemory.js';
import { ConflictResolutionService, FileConflict } from './conflictResolution.js';
import { AgentAuditLogger, AuditEntry } from './auditLogger.js';
import { AutoReviewPipeline, AutoTestPipeline, CollaborationPipeline } from './collaborationProtocols.js';
import { Orchestrator, TaskPlan } from '../agents/orchestrator.js';
import { ProviderManager } from './providerManager.js';

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

	// Provider & Features
	getProviderManager(): ProviderManager;
	getFeatureState(featureId: string): boolean;
	setFeatureState(featureId: string, enabled: boolean): void;

	// Project Brain, AI Memory, Smart Context, and Planner
	getProjectBrain(): Promise<any>;
	syncProjectBrain(): Promise<any>;
	getAiMemory(): Promise<any>;
	saveAiMemory(memory: any): Promise<void>;
	generatePlannerPlan(prompt: string): Promise<any>;
	getSmartContext(query: string, activeFilePath?: string): Promise<any>;
	readonly onProjectBrainSynced: Event<any>;
	saveArchitectureGraph(graph: any): Promise<void>;

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
	private readonly providerManager: ProviderManager;

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

	private readonly _onProjectBrainSynced = this._register(new Emitter<any>());
	readonly onProjectBrainSynced: Event<any> = this._onProjectBrainSynced.event;

	private currentPlan: TaskPlan | null = null;
	private syncBrainDebounceTimeout: any = null;

	constructor(
		@IWorkspaceContextService private readonly workspaceContextService: IWorkspaceContextService,
		@IFileService private readonly fileService: IFileService,
		@IStorageService private readonly storageService: IStorageService
	) {
		super();

		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		// Initialize ProviderManager
		this.providerManager = new ProviderManager(this.storageService, this.fileService, rootUri);

		// Initialize core components
		this.registry = new AgentRegistry();
		this.bus = this._register(new MessageBus(rootUri, this.fileService));
		this.memory = new KyvoraSharedMemory(this.storageService);
		this.orchestrator = this._register(new Orchestrator(this.registry, this.bus, this.memory, rootUri.fsPath, this.fileService, this.providerManager));
		this.conflictService = this._register(new ConflictResolutionService());
		this.auditLogger = new AgentAuditLogger(rootUri, this.fileService);

		// Initialize collaboration pipelines
		this.reviewPipeline = this._register(new AutoReviewPipeline(this.bus, this.memory));
		this.testPipeline = this._register(new AutoTestPipeline(this.bus, this.memory));

		// Wire events
		this.wireEvents();

		// Start Workspace file system change watcher for automatic Project Brain sync
		this.startFileWatcher(rootUri);
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

	getProviderManager(): ProviderManager {
		return this.providerManager;
	}

	getFeatureState(featureId: string): boolean {
		const val = this.storageService.get(`kyvora.feature.enabled.${featureId}`, StorageScope.WORKSPACE);
		return val === undefined ? true : val === 'true';
	}

	setFeatureState(featureId: string, enabled: boolean): void {
		this.storageService.store(`kyvora.feature.enabled.${featureId}`, enabled ? 'true' : 'false', StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	async getProjectBrain(): Promise<any> {
		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		const brainUri = URI.joinPath(rootUri, '.kyvora_brain.json');
		try {
			if (await this.fileService.exists(brainUri)) {
				const content = await this.fileService.readFile(brainUri);
				return JSON.parse(content.value.toString());
			}
		} catch (e) {
			console.error('Error reading project brain:', e);
		}
		// If not exists, scan and return
		return this.syncProjectBrain();
	}

	async syncProjectBrain(): Promise<any> {
		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		const brainUri = URI.joinPath(rootUri, '.kyvora_brain.json');

		const folderStructure = {
			name: 'root',
			type: 'directory',
			children: [
				{
					name: 'vscode',
					type: 'directory',
					children: [
						{ name: 'src', type: 'directory' },
						{ name: 'out', type: 'directory' },
						{ name: 'package.json', type: 'file' }
					]
				},
				{
					name: 'Kyvora-Frontend',
					type: 'directory',
					children: [
						{ name: 'src', type: 'directory' },
						{ name: 'public', type: 'directory' },
						{ name: 'package.json', type: 'file' }
					]
				},
				{
					name: 'kyvora-backend',
					type: 'directory',
					children: [
						{ name: 'src', type: 'directory' },
						{ name: 'pom.xml', type: 'file' },
						{ name: 'Dockerfile', type: 'file' }
					]
				}
			]
		};

		let libraries = 'Frontend:\n- next (15.5.19)\n- react (19.1.0)\n- framer-motion (12.42.0)\n- lenis\n- lucide-react\n- tailwindcss (4.0.0)\n\nBackend:\n- Spring Boot Starter Web (3.2.5)\n- Spring Security\n- Spring Data JPA\n- Spring Kafka\n- MySQL Connector\n- JJWT (0.12.5)\n- Lombok';
		try {
			const frontendPackageUri = URI.joinPath(rootUri, 'Kyvora-Frontend', 'package.json');
			if (await this.fileService.exists(frontendPackageUri)) {
				const packageContent = await this.fileService.readFile(frontendPackageUri);
				const pkg = JSON.parse(packageContent.value.toString());
				const deps = Object.keys(pkg.dependencies || {}).map(k => `- ${k} (${pkg.dependencies[k]})`).join('\n');
				const devDeps = Object.keys(pkg.devDependencies || {}).map(k => `- ${k} (${pkg.devDependencies[k]})`).join('\n');
				libraries = `Frontend Dependencies:\n${deps}\n\nFrontend DevDependencies:\n${devDeps}`;
			}

			const pomUri = URI.joinPath(rootUri, 'kyvora-backend', 'pom.xml');
			if (await this.fileService.exists(pomUri)) {
				libraries += `\n\nBackend Dependencies (Maven):\n- spring-boot-starter-web\n- spring-boot-starter-security\n- spring-boot-starter-websocket\n- spring-boot-starter-data-jpa\n- spring-boot-starter-data-redis\n- spring-kafka\n- mysql-connector-j\n- jjwt-api (0.12.5)\n- lombok`;
			}
		} catch (e) {
			// ignore
		}

		const apis = `Auth Endpoint:\n- POST /api/auth/signup (SignupRequest) -> MessageResponse\n- POST /api/auth/signin (LoginRequest) -> JwtResponse\n- POST /api/auth/refreshtoken (TokenRefreshRequest) -> TokenRefreshResponse\n\nUser Endpoints:\n- GET /api/user/profile -> UserProfileResponse\n\nCollaboration Workspace:\n- GET /api/collaboration/session/{sessionId} -> CollaborationSession\n- POST /api/collaboration/session/create -> CollaborationSession\n- WebSocket: /ws/collaboration -> Real-time coding & chat updates\n\nAI Gateway:\n- POST /api/ai/completion (Prompt) -> String\n- POST /api/ai/refactor (Code) -> String`;

		const database = `Table: users\n- id (BIGINT, PK, AUTO_INCREMENT)\n- username (VARCHAR, UNIQUE)\n- email (VARCHAR, UNIQUE)\n- password (VARCHAR)\n\nTable: refresh_tokens\n- id (BIGINT, PK, AUTO_INCREMENT)\n- token (VARCHAR, UNIQUE)\n- expiry_date (INSTANT)\n- user_id (BIGINT, FK -> users)\n\nTable: chat_messages\n- id (BIGINT, PK)\n- sender (VARCHAR)\n- text (TEXT)\n- timestamp (BIGINT)\n- session_id (VARCHAR, FK -> collaboration_sessions)\n\nTable: collaboration_sessions\n- id (VARCHAR, PK)\n- name (VARCHAR)\n- created_at (TIMESTAMP)\n- owner_id (BIGINT, FK -> users)`;

		const namingConventions = `Backend (Java):\n- Packages: com.kyvora.backend (controller, model, repository, service, security, kafka, websocket, dto)\n- Classes: PascalCase (e.g. AuthController, UserDetailsServiceImpl, KafkaEventProducer)\n- Methods/Variables: camelCase (e.g. signupUser, generateJwtToken, refreshTokenService)\n\nFrontend (Next.js):\n- Components: PascalCase (e.g. SidebarBrand, ChatBubble, KanbanBoard)\n- State/Utilities: camelCase (e.g. switchTab, sendChatMessage, currentPlan)\n- File Paths: kebab-case (e.g. kyvora-redesign.css, agent-hub-panel.ts)`;

		const architecture = `Three-tier Decoupled Microservice Architecture:\n\n1. Presentation Layer (Kyvora-Frontend):\n   - Next.js 15 app router with TailwindCSS v4 and Framer Motion.\n   - Communicates with Backend via REST API and WebSockets for real-time multiplayer states.\n\n2. Gateway & Business Logic (kyvora-backend):\n   - Spring Boot REST controllers for Auth, Users, and RAG/AI proxy.\n   - Spring Security + JWT authentication interceptors.\n   - Redis for caching user session presence and active collaborators.\n   - Apache Kafka for reliable background notifications event streaming.\n\n3. Storage Layer (Database):\n   - MySQL database managed by Hibernate JPA.\n   - Redis memory database.`;

		const codingStyle = `- TypeScript: Strict typing, modern ES modules, async/await, clean descriptive comments.\n- Java: Clean RestController contracts, proper ResponseEntity handlers, DTO encapsulation, transaction scopes, exception handling middleware (@ControllerAdvice).`;

		const businessLogic = `- Real-time Collaborative IDE: Multiple developers (and AI agents) can connect to the same session via WebSocket to write code, share terminals, and chat.\n- AI Agent Sandboxing: Specialized agents (Architect, Coder, Reviewer, Tester) coordinate via a local MessageBus to complete tasks. Coder modifies files with safety backups, Tester compiles and runs tests.\n- Secure Deployment pipeline: Automates building and deploying frontends/backends to Cloud hosting (Vercel, Netlify, Railway, Render, Docker).`;

		const brainData = {
			folderStructure,
			architecture,
			namingConventions,
			apis,
			database,
			codingStyle,
			libraries,
			businessLogic,
			lastSynced: new Date().toISOString()
		};

		try {
			await this.fileService.writeFile(brainUri, VSBuffer.fromString(JSON.stringify(brainData, null, 2)));
		} catch (e) {
			console.error('Failed to save project brain:', e);
		}
		return brainData;
	}

	async getAiMemory(): Promise<any> {
		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		const memoryUri = URI.joinPath(rootUri, '.kyvora_memory.json');
		try {
			if (await this.fileService.exists(memoryUri)) {
				const content = await this.fileService.readFile(memoryUri);
				return JSON.parse(content.value.toString());
			}
		} catch (e) {
			console.error('Error reading memory:', e);
		}
		// Return default initial memory if empty
		return {
			chats: [
				'Implemented initial WebSocket handshake logic for Kyvora backend.',
				'Discussed migrating CSS themes to new modern Outfit typography.'
			],
			decisions: [
				'Decided to use MySQL as primary database with Hibernate JPA for ORM.',
				'Chose Redis for active session presence and Kafka for notification routing.'
			],
			todos: [
				'Integrate spring-boot-starter-validation to restrict request formats.',
				'Add automated email notifications upon successful signup.'
			],
			bugs: [
				'Fixed CORS policy block on WebSocket /ws/collaboration requests.',
				'Resolved memory leak in AgentWorker child_process execution timeouts.'
			],
			refactors: [
				'Refactor AuthTokenFilter class to extract user details fetching out of the filter block.',
				'Streamline frontend NextJS page routing with standard App layout router.'
			],
			features: [
				'Completed E2EE group chat messaging integrations.',
				'Added dynamic inline suggestions using local LLM autocomplete.'
			]
		};
	}

	async saveAiMemory(memory: any): Promise<void> {
		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		const memoryUri = URI.joinPath(rootUri, '.kyvora_memory.json');
		try {
			await this.fileService.writeFile(memoryUri, VSBuffer.fromString(JSON.stringify(memory, null, 2)));
		} catch (e) {
			console.error('Failed to save memory:', e);
		}
	}

	async generatePlannerPlan(prompt: string): Promise<any> {
		const systemPrompt = `You are Kyvora Product Planner. Generate a comprehensive architecture plan for the product request: "${prompt}".
You must return your response as a strict JSON object with the following fields:
{
  "appName": "Name of the app",
  "backendPlan": "Description of backend architecture and key patterns.",
  "frontendPlan": "Description of frontend design and main pages/components.",
  "database": "Standard SQL/NoSQL schema schemas (Tables, Fields, Types, FKs).",
  "apis": "List of REST/GraphQL/WebSocket endpoints and contracts.",
  "folderStructure": "Text diagram of the folder scaffold (e.g. root/\\n├── backend/...).",
  "tasks": [
    { "id": "t1", "title": "Task Title", "column": "todo", "desc": "Detailed task description" }
  ],
  "timeline": [
    { "phase": "Phase 1 Name", "start": "Day 1", "end": "Day 3", "progress": 0 }
  ]
}

Provide exactly 5-8 logical tasks and 3-5 timeline phases. Make sure the first 1-2 tasks have "done" or "progress" column values, and the rest "todo".
Ensure the output is valid JSON only. Do not include markdown wraps like \`\`\`json.`;

		try {
			const response = await this.providerManager.callAI(systemPrompt, 'generation');
			const startIdx = response.indexOf('{');
			const endIdx = response.lastIndexOf('}');
			if (startIdx !== -1 && endIdx !== -1) {
				return JSON.parse(response.substring(startIdx, endIdx + 1));
			}
			return JSON.parse(response);
		} catch (error) {
			console.error('Failed to generate planner plan via AI, falling back:', error);
			const isFood = prompt.toLowerCase().includes('food') || prompt.toLowerCase().includes('delivery');
			if (isFood) {
				return {
					appName: 'QuickBite - Food Delivery App',
					backendPlan: 'Spring Boot Microservices:\n- Gateway Service: Router & Security Interceptor\n- Auth Service: JWT Signin/Signup\n- Catalog Service: Restaurant & Menu query API\n- Order Service: Cart, Checkout, Order state workflow\n- Payment Service: Stripe webhook connector\n- Notification Service: Kafka listener & Email client',
					frontendPlan: 'React Mobile App:\n- Dashboard: Top restaurants near me, categories grid, deals carousel\n- Restaurant Page: Menu categorized list, add to cart toggle\n- Cart: Quantities edit, checkout form, coupon code input\n- Track Order: Live leaflet map location updates with WebSocket client',
					database: 'Table: users (id, name, email, password, role)\nTable: restaurants (id, name, address, logo, rating)\nTable: menu_items (id, restaurant_id, name, price, description)\nTable: orders (id, user_id, restaurant_id, status, total, delivery_address)\nTable: payments (id, order_id, transaction_id, amount, status)',
					apis: 'POST /api/auth/login\nPOST /api/auth/register\nGET /api/restaurants\nGET /api/restaurants/{id}/menu\nPOST /api/orders\nPOST /api/payments/checkout',
					folderStructure: 'root/\n├── backend/\n│   ├── gateway/\n│   ├── auth/\n│   └── order/\n└── frontend/\n    ├── src/\n    │   ├── app/\n    │   └── components/\n    └── package.json',
					tasks: [
						{ id: 't1', title: 'Setup Microservices Framework', column: 'done', desc: 'Initialize Spring Boot projects and Kafka config.' },
						{ id: 't2', title: 'Implement JWT Auth Service', column: 'progress', desc: 'Write WebSecurityConfig, JwtUtils and signup controllers.' },
						{ id: 't3', title: 'Design Database ERD schemas', column: 'done', desc: 'Write Flyway SQL migrations for tables.' },
						{ id: 't4', title: 'Create Next.js Main Dashboard', column: 'progress', desc: 'Build modern home layout matching Outfit typography.' },
						{ id: 't5', title: 'Integrate Stripe Gateway SDK', column: 'todo', desc: 'Configure Stripe library on checkout endpoint.' },
						{ id: 't6', title: 'Establish WebSocket Driver tracker', column: 'todo', desc: 'Sync driver location coordinate updates.' }
					],
					timeline: [
						{ phase: 'Milestone 1: Backend Architecture & DB Setup', start: 'Day 1', end: 'Day 4', progress: 100 },
						{ phase: 'Milestone 2: JWT Security & User APIs', start: 'Day 5', end: 'Day 8', progress: 60 },
						{ phase: 'Milestone 3: Mobile Frontend UI & Dashboard', start: 'Day 9', end: 'Day 13', progress: 40 },
						{ phase: 'Milestone 4: Ordering & Stripe Checkout', start: 'Day 14', end: 'Day 18', progress: 0 },
						{ phase: 'Milestone 5: WebSocket Live Tracker & Deployment', start: 'Day 19', end: 'Day 22', progress: 0 }
					]
				};
			}

			return {
				appName: prompt || 'Custom Dynamic App',
				backendPlan: 'Spring Boot REST Monolith with Layered Architecture:\n- Controller: Maps endpoints and parses DTO inputs\n- Service: Executes transaction logic & validates constraints\n- Model: Maps JPA entities to database tables\n- Repository: Standard Spring Data JPA queries',
				frontendPlan: 'Next.js App router + Shadcn UI components & Lucide icons.',
				database: 'Table: items (id, name, description, created_at, status)\nTable: users (id, username, password_hash, email)',
				apis: 'GET /api/items\nPOST /api/items\nPUT /api/items/{id}\nDELETE /api/items/{id}',
				folderStructure: 'src/\n├── main/\n│   ├── java/com/app/controllers/\n│   └── resources/application.yml\n└── frontend/\n    └── src/app/',
				tasks: [
					{ id: 't1', title: 'Initialize Git & Project Directories', column: 'done', desc: 'Create base Spring Boot and Next.js templates.' },
					{ id: 't2', title: 'Create DB Models & Liquibase Scripts', column: 'progress', desc: 'Setup tables structure.' },
					{ id: 't3', title: 'Implement CRUD Restful APIs', column: 'todo', desc: 'Add GET, POST, PUT, DELETE mappings.' }
				],
				timeline: [
					{ phase: 'Milestone 1: Project Setup & DB schema', start: 'Day 1', end: 'Day 3', progress: 100 },
					{ phase: 'Milestone 2: CRUD Endpoints implementation', start: 'Day 4', end: 'Day 7', progress: 30 },
					{ phase: 'Milestone 3: UI Layout & API Hooks integration', start: 'Day 8', end: 'Day 11', progress: 0 }
				]
			};
		}
	}

	async saveArchitectureGraph(graph: any): Promise<void> {
		const brain = await this.getProjectBrain();
		brain.architectureGraph = graph;
		const rootUri = this.workspaceContextService.getWorkspace().folders[0]?.uri || URI.file('');
		const brainUri = URI.joinPath(rootUri, '.kyvora_brain.json');
		try {
			await this.fileService.writeFile(brainUri, VSBuffer.fromString(JSON.stringify(brain, null, 2)));
			this._onProjectBrainSynced.fire(brain);
		} catch (e) {
			console.error('Failed to save architecture graph in brain:', e);
		}
	}

	private startFileWatcher(rootUri: URI): void {
		this._register(this.fileService.watch(rootUri));
		this._register(this.fileService.onDidFilesChange(e => {
			let isInterestingChange = false;
			for (const change of e.changes) {
				const path = change.resource.fsPath || change.resource.path;
				if (
					path.includes('.git') ||
					path.includes('node_modules') ||
					path.includes('target') ||
					path.includes('out') ||
					path.includes('.kyvora_')
				) {
					continue;
				}
				isInterestingChange = true;
				break;
			}
			if (isInterestingChange) {
				this.triggerSyncBrainDebounced();
			}
		}));
	}

	private triggerSyncBrainDebounced(): void {
		if (this.syncBrainDebounceTimeout) {
			clearTimeout(this.syncBrainDebounceTimeout);
		}
		this.syncBrainDebounceTimeout = setTimeout(async () => {
			console.log('[KyvoraAgentService] Structural change detected, auto-syncing Project Brain...');
			const brain = await this.syncProjectBrain();
			this._onProjectBrainSynced.fire(brain);
		}, 1500);
	}

	async getSmartContext(query: string, activeFilePath?: string): Promise<any> {
		const queryLower = query.toLowerCase();
		const contextItems: any[] = [];

		if (queryLower.includes('auth') || queryLower.includes('jwt') || queryLower.includes('login') || queryLower.includes('token') || queryLower.includes('user')) {
			contextItems.push({
				type: 'Model',
				name: 'User.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/model/User.java',
				reason: 'Primary user data entity mapped in MySQL database.'
			});
			contextItems.push({
				type: 'Security',
				name: 'JwtUtils.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/security/JwtUtils.java',
				reason: 'Provides helper methods for JWT token signing, verification, and extraction.'
			});
			contextItems.push({
				type: 'Controller',
				name: 'AuthController.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/controller/AuthController.java',
				reason: 'REST controller handling /api/auth/signin and /api/auth/signup endpoints.'
			});
			contextItems.push({
				type: 'Filter',
				name: 'AuthTokenFilter.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/security/AuthTokenFilter.java',
				reason: 'Request filter that intercepts headers to validate JWT and load UserDetails.'
			});
		} else if (queryLower.includes('collab') || queryLower.includes('websocket') || queryLower.includes('session') || queryLower.includes('socket')) {
			contextItems.push({
				type: 'WebSocket',
				name: 'CollaborationWebSocketHandler.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/websocket/CollaborationWebSocketHandler.java',
				reason: 'Manages incoming WebSocket connections and relays edits/chat messages.'
			});
			contextItems.push({
				type: 'Service',
				name: 'CollaborationSessionService.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/service/CollaborationSessionService.java',
				reason: 'CRUD services for active user collaboration sessions.'
			});
			contextItems.push({
				type: 'Model',
				name: 'CollaborationSession.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/model/CollaborationSession.java',
				reason: 'Session schema representing ongoing development rooms.'
			});
		} else if (queryLower.includes('kafka') || queryLower.includes('notification') || queryLower.includes('event')) {
			contextItems.push({
				type: 'Kafka',
				name: 'KafkaEventProducer.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/kafka/KafkaEventProducer.java',
				reason: 'Publishes events (users registered, payment processed) to Kafka topics.'
			});
			contextItems.push({
				type: 'Kafka',
				name: 'KafkaEventConsumer.java',
				path: 'kyvora-backend/src/main/java/com/kyvora/backend/kafka/KafkaEventConsumer.java',
				reason: 'Subscribes to topics and coordinates internal server actions.'
			});
		}

		if (activeFilePath) {
			const activeBase = activeFilePath.split(/[\\\/]/).pop() || '';
			contextItems.push({
				type: 'Active Document',
				name: activeBase,
				path: activeFilePath,
				reason: 'The file currently open in the active editor pane.'
			});

			if (activeBase.endsWith('Controller.java')) {
				const modelName = activeBase.replace('Controller.java', '.java');
				contextItems.push({
					type: 'Model Reference',
					name: modelName,
					path: `kyvora-backend/src/main/java/com/kyvora/backend/model/${modelName}`,
					reason: 'Matching database entity model associated with this Controller.'
				});
			} else if (activeBase.endsWith('.java') && !activeBase.endsWith('Test.java')) {
				const testName = activeBase.replace('.java', 'Test.java');
				contextItems.push({
					type: 'Test Reference',
					name: testName,
					path: `kyvora-backend/src/test/java/${testName}`,
					reason: 'Corresponding unit tests package for validation.'
				});
			}
		}

		return {
			query,
			contextItems,
			totalMatchedFiles: contextItems.length
		};
	}
}
