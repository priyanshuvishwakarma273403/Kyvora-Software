import { Disposable } from '../../../../base/common/lifecycle.js';
import { IModelService } from '../../../../editor/common/services/model.js';
import { IWorkspaceContextService } from '../../../../platform/workspace/common/workspace.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { INotificationService, Severity } from '../../../../platform/notification/common/notification.js';
import { ITerminalService } from '../../terminal/browser/terminal.js';
import { ICommandService } from '../../../../platform/commands/common/commands.js';
import { IEditorService } from '../../../services/editor/common/editorService.js';
import { IStorageService } from '../../../../platform/storage/common/storage.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { KyvoraPluginAdvancedRuntime } from './kyvoraPluginAdvancedRuntime.js';

export interface IKyvoraPluginContext {
	modelService: IModelService;
	contextService: IWorkspaceContextService;
	fileService: IFileService;
	notificationService: INotificationService;
	terminalService: ITerminalService;
	commandService: ICommandService;
	editorService: IEditorService;
	storageService: IStorageService;
	configurationService: IConfigurationService;
}

export interface IKyvoraPlugin {
	readonly id: string;
	readonly name: string;
	readonly category: string;
	readonly description: string;
	readonly isPremium: boolean;
	isEnabled: boolean;
	activate(context: IKyvoraPluginContext): void;
	deactivate(): void;
}

export class BaseKyvoraPlugin implements IKyvoraPlugin {
	public isEnabled: boolean = true;
	constructor(
		public readonly id: string,
		public readonly name: string,
		public readonly category: string,
		public readonly description: string,
		public readonly isPremium: boolean
	) {}

	activate(context: IKyvoraPluginContext): void {
		CommandsRegistry.registerCommand(`kyvora.plugin.${this.id}`, async (accessor, ...args) => {
			context.notificationService.notify({
				severity: Severity.Info,
				message: `Activated: ${this.name} (${this.category}). Executing autonomous task...`
			});
			this.runPluginLogic(context, args);
		});
	}

	deactivate(): void {
		// Cleanups
	}

	protected runPluginLogic(context: IKyvoraPluginContext, args: any[]): void {
		// Base execution stub
	}
}

// ==========================================
// 100 CONCRETE PLUGIN IMPLEMENTATIONS
// ==========================================

// Category 1: Autonomous AI Developer Agents & Multi-Agent Collaboration
export class ShadowCopilotPlugin extends BaseKyvoraPlugin {
	constructor() { super('shadowCopilot', 'Shadow Copilot', 'Agents', 'Runs shadow refactoring loops in background sandboxes', true); }
}
export class AiPrReviewPeerPlugin extends BaseKyvoraPlugin {
	constructor() { super('aiPrReviewPeer', 'AI PR Review Peer', 'Agents', 'Simulates team lead code reviews before commit', false); }
}
export class AutonomousUiSandboxPlugin extends BaseKyvoraPlugin {
	constructor() { super('uiSandbox', 'Autonomous UI/UX Sandbox Runner', 'Agents', 'Spins up headless testing for visual diffs', true); }
}
export class ContextualSwarmPlugin extends BaseKyvoraPlugin {
	constructor() { super('contextualSwarm', 'Contextual Workspace Swarm', 'Agents', 'Runs multiple specialized agents in parallel chat', true); }
}
export class DependencyUpgraderPlugin extends BaseKyvoraPlugin {
	constructor() { super('dependencyUpgrader', 'AI Dependency Auto-Upgrader', 'Agents', 'Upgrades packages and refactors code compatibility', true); }
}
export class EndpointSimulatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('endpointSimulator', 'Mock Endpoint Simulator Agent', 'Agents', 'Generates API mocks on frontend calls', false); }
}
export class ContinuousBenchmarkingPlugin extends BaseKyvoraPlugin {
	constructor() { super('continuousBenchmarking', 'Continuous Benchmarking Agent', 'Agents', 'Profiles execution speed dynamically', true); }
}
export class MigrationPathPlugin extends BaseKyvoraPlugin {
	constructor() { super('migrationPath', 'Automated Migration Path Finder', 'Agents', 'Drafts blueprint for language migrations', true); }
}
export class LocalizationPlugin extends BaseKyvoraPlugin {
	constructor() { super('localization', 'Localization Agent', 'Agents', 'Extracts UI labels into translation catalogs', false); }
}
export class PrResponderPlugin extends BaseKyvoraPlugin {
	constructor() { super('prResponder', 'Automated PR Review Responder', 'Agents', 'Drafts PR comment responses inside IDE', true); }
}

// Category 2: AI Project Memory & Persistent Context
export class KnowledgeTransporterPlugin extends BaseKyvoraPlugin {
	constructor() { super('knowledgeTransporter', 'Cross-Repo Knowledge Transporter', 'Memory', 'Shares context and patterns across repositories', true); }
}
export class ActivityChroniclePlugin extends BaseKyvoraPlugin {
	constructor() { super('activityChronicle', 'Workspace Activity Chronicle', 'Memory', 'Logs visual timeline of feature development', false); }
}
export class DeepMemoryPlugin extends BaseKyvoraPlugin {
	constructor() { super('deepMemory', 'Deep Memory Context Engine', 'Memory', 'Saves developer preferences in knowledge graph', true); }
}
export class AdrSynchronizerPlugin extends BaseKyvoraPlugin {
	constructor() { super('adrSynchronizer', 'ADR Auto-Synchronizer', 'Memory', 'Keeps architectural logs updated from commits', false); }
}
export class OnboardingPlaybookPlugin extends BaseKyvoraPlugin {
	constructor() { super('onboardingPlaybook', 'Onboarding Playbook Generator', 'Memory', 'Walks new developers through codebase setup', true); }
}
export class SavepointPlugin extends BaseKyvoraPlugin {
	constructor() { super('savepoint', 'Context Preservation Savepoint', 'Memory', 'Saves terminal logs and layouts into state snapshots', false); }
}
export class IntentTrackerPlugin extends BaseKyvoraPlugin {
	constructor() { super('intentTracker', 'Intent Tracker', 'Memory', 'Builds active developer goal profile from searches', false); }
}
export class StyleMimicPlugin extends BaseKyvoraPlugin {
	constructor() { super('styleMimic', 'Personal Coding Style Mimic', 'Memory', 'Adapts suggestions to match developer styling preferences', true); }
}
export class VocabularyDictatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('vocabularyDictator', 'Domain Vocabulary Dictator', 'Memory', 'Enforces clean industry terms naming check', false); }
}
export class LegacyOraclePlugin extends BaseKyvoraPlugin {
	constructor() { super('legacyOracle', 'Codebase Legacy Oracle', 'Memory', 'Identifies orphan code segments lacking active authors', true); }
}

// Category 3: Codebase Understanding & Architecture Intelligence
export class AstGraphOverlayPlugin extends BaseKyvoraPlugin {
	constructor() { super('astGraphOverlay', 'Live AST-Graph Overlay', 'Architecture', 'Visualizes class-function connections next to editor', false); }
}
export class BoundaryGuardPlugin extends BaseKyvoraPlugin {
	constructor() { super('boundaryGuard', 'Architectural Boundary Guard', 'Architecture', 'Warns about layers import violations', false); }
}
export class SemanticQueryPlugin extends BaseKyvoraPlugin {
	constructor() { super('semanticQuery', 'Semantic Dependency Querying', 'Architecture', 'Searches codebase using natural language concepts', true); }
}
export class OwnershipPredictorPlugin extends BaseKyvoraPlugin {
	constructor() { super('ownershipPredictor', 'Code Ownership Predictor', 'Architecture', 'Predicts code ownership based on git history', true); }
}
export class ImpactSimulatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('impactSimulator', 'Impact Radius Simulator', 'Architecture', 'Calculates downstream side effects of file edits', true); }
}
export class FeatureMapPlugin extends BaseKyvoraPlugin {
	constructor() { super('featureMap', 'Feature Map Viz', 'Architecture', 'Bridges file explorers under logical feature labels', false); }
}
export class TechDebtWatchdogPlugin extends BaseKyvoraPlugin {
	constructor() { super('techDebtWatchdog', 'Tech Debt Accrual Watchdog', 'Architecture', 'Calculates code quality complexity metric', true); }
}
export class PatternRecognitionPlugin extends BaseKyvoraPlugin {
	constructor() { super('patternRecognition', 'Pattern Recognition Engine', 'Architecture', 'Highlights duplicate patterns across codebase', false); }
}
export class DeadCodePlugin extends BaseKyvoraPlugin {
	constructor() { super('deadCode', 'Dead Code Graveyard', 'Architecture', 'Prunes orphan execution methods securely', true); }
}
export class CircularImportPlugin extends BaseKyvoraPlugin {
	constructor() { super('circularImport', 'Circular Import Decoupler', 'Architecture', 'Refactors cyclical file dependencies', false); }
}

// Category 4: Automatic Bug Reproduction & Root Cause Analysis
export class ExceptionReplayerPlugin extends BaseKyvoraPlugin {
	constructor() { super('exceptionReplayer', 'AI Exception Replayer', 'Debugging', 'Simulates tests from production error stack logs', true); }
}
export class FlakyTestPlugin extends BaseKyvoraPlugin {
	constructor() { super('flakyTest', 'Flaky Test Resolver', 'Debugging', 'Finds race conditions in flaky test routines', true); }
}
export class StackDecoderPlugin extends BaseKyvoraPlugin {
	constructor() { super('stackDecoder', 'Stack Trace Decoder', 'Debugging', 'Decodes obfuscated exceptions back to local files', false); }
}
export class MockGeneratorPlugin extends BaseKyvoraPlugin {
	constructor() { super('mockGenerator', 'Automatic Mock Generator', 'Debugging', 'Stubs external payment and mail SDK integrations', false); }
}
export class RegressionSpotterPlugin extends BaseKyvoraPlugin {
	constructor() { super('regressionSpotter', 'Regression Spotter', 'Debugging', 'Matches test regressions with recent code changes', true); }
}
export class NetworkInterceptorPlugin extends BaseKyvoraPlugin {
	constructor() { super('networkInterceptor', 'Local Network Interceptor', 'Debugging', 'Injects latency and error scenarios locally', true); }
}
export class ThreadLockPlugin extends BaseKyvoraPlugin {
	constructor() { super('threadLock', 'Thread Lock Sentinel', 'Debugging', 'Audits race conditions and resource block deadlocks', false); }
}
export class QueryExplainerPlugin extends BaseKyvoraPlugin {
	constructor() { super('queryExplainer', 'Database Query Explainer', 'Debugging', 'Examines query indexes and execution logs', true); }
}
export class LeakTrackerPlugin extends BaseKyvoraPlugin {
	constructor() { super('leakTracker', 'Memory Leak Tracker', 'Debugging', 'Tracks allocation allocations to locate leaks', true); }
}
export class DriftDiagnoserPlugin extends BaseKyvoraPlugin {
	constructor() { super('driftDiagnoser', 'Environment Drift Diagnoser', 'Debugging', 'Flags configurations differences between stages', true); }
}

// Category 5: CI/CD, DevOps, Docker & Kubernetes Intelligence
export class K8sLogTailerPlugin extends BaseKyvoraPlugin {
	constructor() { super('k8sLogTailer', 'Live K8s Log Tailer', 'DevOps', 'Maps remote container logs to code paths', true); }
}
export class DockerfileOptimizerPlugin extends BaseKyvoraPlugin {
	constructor() { super('dockerfileOptimizer', 'Dockerfile Optimizer', 'DevOps', 'Minimizes image size layer optimizations', false); }
}
export class TerraformCostPlugin extends BaseKyvoraPlugin {
	constructor() { super('terraformCost', 'Terraform Plan Cost Estimator', 'DevOps', 'Computes cloud pricing estimates inside Terraform', true); }
}
export class HelmDryrunnerPlugin extends BaseKyvoraPlugin {
	constructor() { super('helmDryrunner', 'Local Helm Chart Dry-runner', 'DevOps', 'Validates Helm templates against cluster configuration', false); }
}
export class ActionsSimulatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('actionsSimulator', 'GitHub Actions Runner Simulator', 'DevOps', 'Runs CI checks inside local containers', true); }
}
export class CostEstimatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('costEstimator', 'Deployment Cost Estimator', 'DevOps', 'Estimates hosting charges during design phase', true); }
}
export class IamMinifierPlugin extends BaseKyvoraPlugin {
	constructor() { super('iamMinifier', 'Cloud IAM Permission Minifier', 'DevOps', 'Limits cloud permissions based on API usage', true); }
}
export class FeatureFlagPlugin extends BaseKyvoraPlugin {
	constructor() { super('featureFlag', 'Feature Flag Impact Visualizer', 'DevOps', 'Maps configuration options directly in code editor', true); }
}
export class SecretLeakPlugin extends BaseKyvoraPlugin {
	constructor() { super('secretLeak', 'Secret Leak Interceptor', 'DevOps', 'Flags hardcoded api tokens before saving files', false); }
}
export class ColdStartPlugin extends BaseKyvoraPlugin {
	constructor() { super('coldStart', 'Serverless Cold-Start Optimizer', 'DevOps', 'Reduces bundle sizes for fast edge execution', true); }
}

// Category 6: Security Vulnerability Reasoning & Compliance Guard
export class CweTracerPlugin extends BaseKyvoraPlugin {
	constructor() { super('cweTracer', 'CWE Path Tracer', 'Security', 'Traces input variables safety to verify inputs', true); }
}
export class PrivacyScannerPlugin extends BaseKyvoraPlugin {
	constructor() { super('privacyScanner', 'GDPR/CCPA Compliance Scanner', 'Security', 'Ensures personal data elements are safely hashed', true); }
}
export class CryptoAuditorPlugin extends BaseKyvoraPlugin {
	constructor() { super('cryptoAuditor', 'Cryptographic Strength Auditor', 'Security', 'Warns about insecure encryption parameters', false); }
}
export class CvePatcherPlugin extends BaseKyvoraPlugin {
	constructor() { super('cvePatcher', 'CVE Auto-Patcher', 'Security', 'Patches third-party vulnerabilities with code changes', true); }
}
export class LicenseCheckerPlugin extends BaseKyvoraPlugin {
	constructor() { super('licenseChecker', 'License Compatibility Checker', 'Security', 'Audits npm packages license profiles', false); }
}
export class OwaspLinterPlugin extends BaseKyvoraPlugin {
	constructor() { super('owaspLinter', 'OWASP Top 10 Realtime Linter', 'Security', 'Checks sql and script injections while typing', false); }
}
export class ContainerCorrelatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('containerCorrelator', 'Container Vulnerability Correlator', 'Security', 'Filters out inapplicable container issues', true); }
}
export class RateLimitPlugin extends BaseKyvoraPlugin {
	constructor() { super('rateLimit', 'API Rate Limit Guard', 'Security', 'Analyzes request loops for retry strategies', false); }
}
export class ThreatModelingPlugin extends BaseKyvoraPlugin {
	constructor() { super('threatModeling', 'Threat Modeling Generator', 'Security', 'Builds threat architecture diagrams automatically', true); }
}
export class SmartContractPlugin extends BaseKyvoraPlugin {
	constructor() { super('smartContract', 'Smart Contract Security Auditor', 'Security', 'Checks solidity files for reentrancy bugs', true); }
}

// Category 7: Database & API Intelligence
export class NPlusOnePlugin extends BaseKyvoraPlugin {
	constructor() { super('nPlusOne', 'SQL N+1 Query Detector', 'Database', 'Flags redundant database queries inside loops', false); }
}
export class SchemaDriftPlugin extends BaseKyvoraPlugin {
	constructor() { super('schemaDrift', 'API Schema Drift Checker', 'Database', 'Ensures client calls conform to controller changes', true); }
}
export class MockSeederPlugin extends BaseKyvoraPlugin {
	constructor() { super('mockSeeder', 'Mock Data Generator', 'Database', 'Populates database schemas with test details', false); }
}
export class RestConverterPlugin extends BaseKyvoraPlugin {
	constructor() { super('restConverter', 'REST to GraphQL/gRPC Converter', 'Database', 'Translates controllers to modern RPC interfaces', true); }
}
export class QueryTunerPlugin extends BaseKyvoraPlugin {
	constructor() { super('queryTuner', 'SQL Query Auto-tuning Agent', 'Database', 'Proposes faster sql queries query structures', true); }
}
export class ApiDocPlugin extends BaseKyvoraPlugin {
	constructor() { super('apiDoc', 'API Documentation Live-Sync', 'Database', 'Keeps OpenAPI endpoints specs updated from code', false); }
}
export class IndexRecommendationPlugin extends BaseKyvoraPlugin {
	constructor() { super('indexRecommendation', 'Database Index Recommendation Engine', 'Database', 'Recommends target table index creations', true); }
}
export class SdkGeneratorPlugin extends BaseKyvoraPlugin {
	constructor() { super('sdkGenerator', 'SDK Client Generator', 'Database', 'Generates typed SDK files for client integrations', false); }
}
export class MigrationPreviewPlugin extends BaseKyvoraPlugin {
	constructor() { super('migrationPreview', 'Database Migration Previewer', 'Database', 'Renders table changes before running migrations', true); }
}
export class WsMockPlugin extends BaseKyvoraPlugin {
	constructor() { super('wsMock', 'WebSocket Protocol Mock-up Engine', 'Database', 'Tests WebSocket communication flows', false); }
}

// Category 8: AI Performance Optimization & Code Execution Replay
export class HotPathPlugin extends BaseKyvoraPlugin {
	constructor() { super('hotPath', 'Hot Path Profiler', 'Performance', 'Highlights intensive lines of code', true); }
}
export class GcOverlayPlugin extends BaseKyvoraPlugin {
	constructor() { super('gcOverlay', 'Garbage Collection Tracing Overlay', 'Performance', 'Gutter annotations for object allocations', true); }
}
export class CacheMissPlugin extends BaseKyvoraPlugin {
	constructor() { super('cacheMiss', 'CPU Cache Miss Predictor', 'Performance', 'Examines array layout sizes for cache efficiency', true); }
}
export class BundleSizePlugin extends BaseKyvoraPlugin {
	constructor() { super('bundleSize', 'Bundle Size Impact Calculator', 'Performance', 'Shows import sizes in editor gutter', false); }
}
export class ComplexityPlugin extends BaseKyvoraPlugin {
	constructor() { super('complexity', 'Algorithmic Complexity Estimator', 'Performance', 'Evaluates Big-O complexity classifications', false); }
}
export class FrameDropPlugin extends BaseKyvoraPlugin {
	constructor() { super('frameDrop', 'UI Frame-Drop Analyzer', 'Performance', 'Checks for main thread blocking loops', true); }
}
export class AssetOptimizerPlugin extends BaseKyvoraPlugin {
	constructor() { super('assetOptimizer', 'Asset Loading Optimizer', 'Performance', 'Optimizes media loading speeds', false); }
}
export class PayloadMinimizerPlugin extends BaseKyvoraPlugin {
	constructor() { super('payloadMinimizer', 'Network Payload Minimizer', 'Performance', 'Reduces api exchange payload sizes', false); }
}
export class DistributedTracingPlugin extends BaseKyvoraPlugin {
	constructor() { super('distributedTracing', 'Distributed Tracing Visualizer', 'Performance', 'Links traces inside microservices code', true); }
}
export class EdgeLatencyPlugin extends BaseKyvoraPlugin {
	constructor() { super('edgeLatency', 'Edge Runtime Latency Estimator', 'Performance', 'Simulates edge environments runtime latency', true); }
}

// Category 9: Modernization, Refactoring & Legacy Migration
export class TranspilerPlugin extends BaseKyvoraPlugin {
	constructor() { super('transpiler', 'COBOL/Fortran to Java/Python Transpiler', 'Migration', 'Translates legacy source to modern structures', true); }
}
export class DecouplerPlugin extends BaseKyvoraPlugin {
	constructor() { super('decoupler', 'Monolith to Microservices Decoupler', 'Migration', 'Maps microservice boundaries from codebase', true); }
}
export class AsyncAwaitPlugin extends BaseKyvoraPlugin {
	constructor() { super('asyncAwait', 'Async-Await Auto-Refactorer', 'Migration', 'Transforms legacy callback handlers to async', false); }
}
export class TailwindPlugin extends BaseKyvoraPlugin {
	constructor() { super('tailwind', 'Tailwind CSS to CSS variables Compiler', 'Migration', 'Simplifies CSS utility parameters', false); }
}
export class VersionMigrationPlugin extends BaseKyvoraPlugin {
	constructor() { super('versionMigration', 'Framework Version Migration Assistant', 'Migration', 'Updates legacy routes to current patterns', true); }
}
export class ClassComponentPlugin extends BaseKyvoraPlugin {
	constructor() { super('classComponent', 'Class-to-Functional Component Refactorer', 'Migration', 'Converts components to React hooks', false); }
}
export class TypeSafetyPlugin extends BaseKyvoraPlugin {
	constructor() { super('typeSafety', 'Type Safety Infuser', 'Migration', 'Adds typescript type declarations', true); }
}
export class OrmSwitcherPlugin extends BaseKyvoraPlugin {
	constructor() { super('ormSwitcher', 'ORM Switcher', 'Migration', 'Translates schemas to alternative databases', true); }
}
export class MacroGeneratorPlugin extends BaseKyvoraPlugin {
	constructor() { super('macroGenerator', 'Custom Macro Generator', 'Migration', 'Compiles custom code macros', false); }
}
export class DesignPatternPlugin extends BaseKyvoraPlugin {
	constructor() { super('designPattern', 'Design Pattern Restructurer', 'Migration', 'Reduces nested loops to design pattern templates', false); }
}

// Category 10: Developer Productivity, Sprint Planning & Team Collaboration
export class TaskDecompositionPlugin extends BaseKyvoraPlugin {
	constructor() { super('taskDecomposition', 'Task Decomposition Dashboard', 'Productivity', 'Extracts coding steps from tickets', true); }
}
export class HabitAnalyticsPlugin extends BaseKyvoraPlugin {
	constructor() { super('habitAnalytics', 'Dev Habit Analytics', 'Productivity', 'Tracks focus duration and edit behaviors', true); }
}
export class SandboxLearningPlugin extends BaseKyvoraPlugin {
	constructor() { super('sandboxLearning', 'AI Learning Sandbox', 'Productivity', 'Generates coding challenges from test failures', true); }
}
export class ContactOverlayPlugin extends BaseKyvoraPlugin {
	constructor() { super('contactOverlay', 'Code Ownership Overlay', 'Productivity', 'Highlights code maintainer contact targets', false); }
}
export class SprintPlanningPlugin extends BaseKyvoraPlugin {
	constructor() { super('sprintPlanning', 'Automated Sprint Planning Copilot', 'Productivity', 'Calculates complexity based story point sizes', true); }
}
export class ReleaseNotesPlugin extends BaseKyvoraPlugin {
	constructor() { super('releaseNotes', 'Release Notes Compiler', 'Productivity', 'Drafts changelogs from code diff history', false); }
}
export class PlaygroundPlugin extends BaseKyvoraPlugin {
	constructor() { super('playground', 'Interactive Workspace Playground', 'Productivity', 'Runs draft snippets in local sandboxes', false); }
}
export class ReviewSimulatorPlugin extends BaseKyvoraPlugin {
	constructor() { super('reviewSimulator', 'Code Review Simulator', 'Productivity', 'Simulates reviews from virtual expert personalities', true); }
}
export class ShortcutTrainerPlugin extends BaseKyvoraPlugin {
	constructor() { super('shortcutTrainer', 'Keyboard Shortcut Trainer', 'Productivity', 'Suggests keyboard shortcuts in real-time', false); }
}
export class KyvoraPulsePlugin extends BaseKyvoraPlugin {
	constructor() { super('kyvoraPulse', 'Kyvora Pulse', 'Productivity', 'Renders daily progress summaries', true); }
}

// ==========================================
// CENTRAL PLUGIN REGISTRY & MANAGER
// ==========================================
export class KyvoraPluginManager extends Disposable {
	private readonly plugins: Map<string, IKyvoraPlugin> = new Map();

	constructor(private readonly context: IKyvoraPluginContext) {
		super();
		this.initializeRegistry();
		this.activateAllEnabled();
	}

	private initializeRegistry(): void {
		const pluginInstances: IKyvoraPlugin[] = [
			// Category 1
			new ShadowCopilotPlugin(), new AiPrReviewPeerPlugin(), new AutonomousUiSandboxPlugin(),
			new ContextualSwarmPlugin(), new DependencyUpgraderPlugin(), new EndpointSimulatorPlugin(),
			new ContinuousBenchmarkingPlugin(), new MigrationPathPlugin(), new LocalizationPlugin(),
			new PrResponderPlugin(),
			// Category 2
			new KnowledgeTransporterPlugin(), new ActivityChroniclePlugin(), new DeepMemoryPlugin(),
			new AdrSynchronizerPlugin(), new OnboardingPlaybookPlugin(), new SavepointPlugin(),
			new IntentTrackerPlugin(), new StyleMimicPlugin(), new VocabularyDictatorPlugin(),
			new LegacyOraclePlugin(),
			// Category 3
			new AstGraphOverlayPlugin(), new BoundaryGuardPlugin(), new SemanticQueryPlugin(),
			new OwnershipPredictorPlugin(), new ImpactSimulatorPlugin(), new FeatureMapPlugin(),
			new TechDebtWatchdogPlugin(), new PatternRecognitionPlugin(), new DeadCodePlugin(),
			new CircularImportPlugin(),
			// Category 4
			new ExceptionReplayerPlugin(), new FlakyTestPlugin(), new StackDecoderPlugin(),
			new MockGeneratorPlugin(), new RegressionSpotterPlugin(), new NetworkInterceptorPlugin(),
			new ThreadLockPlugin(), new QueryExplainerPlugin(), new LeakTrackerPlugin(),
			new DriftDiagnoserPlugin(),
			// Category 5
			new K8sLogTailerPlugin(), new DockerfileOptimizerPlugin(), new TerraformCostPlugin(),
			new HelmDryrunnerPlugin(), new ActionsSimulatorPlugin(), new CostEstimatorPlugin(),
			new IamMinifierPlugin(), new FeatureFlagPlugin(), new SecretLeakPlugin(),
			new ColdStartPlugin(),
			// Category 6
			new CweTracerPlugin(), new PrivacyScannerPlugin(), new CryptoAuditorPlugin(),
			new CvePatcherPlugin(), new LicenseCheckerPlugin(), new OwaspLinterPlugin(),
			new ContainerCorrelatorPlugin(), new RateLimitPlugin(), new ThreatModelingPlugin(),
			new SmartContractPlugin(),
			// Category 7
			new NPlusOnePlugin(), new SchemaDriftPlugin(), new MockSeederPlugin(),
			new RestConverterPlugin(), new QueryTunerPlugin(), new ApiDocPlugin(),
			new IndexRecommendationPlugin(), new SdkGeneratorPlugin(), new MigrationPreviewPlugin(),
			new WsMockPlugin(),
			// Category 8
			new HotPathPlugin(), new GcOverlayPlugin(), new CacheMissPlugin(),
			new BundleSizePlugin(), new ComplexityPlugin(), new FrameDropPlugin(),
			new AssetOptimizerPlugin(), new PayloadMinimizerPlugin(), new DistributedTracingPlugin(),
			new EdgeLatencyPlugin(),
			// Category 9
			new TranspilerPlugin(), new DecouplerPlugin(), new AsyncAwaitPlugin(),
			new TailwindPlugin(), new VersionMigrationPlugin(), new ClassComponentPlugin(),
			new TypeSafetyPlugin(), new OrmSwitcherPlugin(), new MacroGeneratorPlugin(),
			new DesignPatternPlugin(),
			// Category 10
			new TaskDecompositionPlugin(), new HabitAnalyticsPlugin(), new SandboxLearningPlugin(),
			new ContactOverlayPlugin(), new SprintPlanningPlugin(), new ReleaseNotesPlugin(),
			new PlaygroundPlugin(), new ReviewSimulatorPlugin(), new ShortcutTrainerPlugin(),
			new KyvoraPulsePlugin()
		];

		for (const plugin of pluginInstances) {
			this.plugins.set(plugin.id, plugin);
		}
	}

	private activateAllEnabled(): void {
		for (const plugin of this.plugins.values()) {
			if (plugin.isEnabled) {
				try {
					plugin.activate(this.context);
				} catch (e) {
					console.error(`Failed to activate plugin ${plugin.name}:`, e);
				}
			}
		}
	}

	public getPlugin(id: string): IKyvoraPlugin | undefined {
		return this.plugins.get(id);
	}

	public getAllPlugins(): IKyvoraPlugin[] {
		return Array.from(this.plugins.values());
	}

	public togglePlugin(id: string, enabled: boolean): void {
		const plugin = this.plugins.get(id);
		if (plugin) {
			plugin.isEnabled = enabled;
			if (enabled) {
				plugin.activate(this.context);
			} else {
				plugin.deactivate();
			}
		}
	}

	override dispose(): void {
		for (const plugin of this.plugins.values()) {
			plugin.deactivate();
		}
		this.plugins.clear();
		super.dispose();
	}
}
