/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

export interface AgentDefinition {
	id: string;                          // unique ID e.g. 'kyvora.agent.coder'
	name: string;                        // display name e.g. 'Coder Agent'
	description: string;                 // what this agent does
	systemPrompt: string;                // this agent's personality/instructions
	capabilities: AgentCapability[];     // what this agent can do
	preferredModel: ModelPreference;     // which AI model works best for this agent
	maxConcurrentTasks: number;          // how many tasks this agent handles at once
	priority: number;                    // 1-10, higher = gets resources first
	canSpawnSubAgents: boolean;          // can this agent create child agents
	inputTypes: string[];                // what message types it accepts (corresponds to MessageType)
	outputTypes: string[];               // what message types it produces
	tools: AgentTool[];                  // file read/write/run tools this agent can use
}

export type AgentCapability =
	| 'read_file' | 'write_file' | 'create_file' | 'delete_file'
	| 'run_terminal' | 'run_tests' | 'read_git' | 'write_git'
	| 'search_codebase' | 'call_ai' | 'spawn_agent' | 'send_message'
	| 'read_memory' | 'write_memory' | 'create_annotation';

export type ModelPreference = {
	primary: 'claude-opus' | 'claude-sonnet' | 'claude-haiku' | 'gpt-4o' | 'gemini-ultra' | 'local';
	fallback: string;
	reason: string;  // why this model for this agent
};

export type AgentTool =
	| 'read_file' | 'write_file' | 'create_file' | 'run_command'
	| 'run_tests' | 'search_codebase' | 'read_git_log' | 'create_annotation'
	| 'send_message' | 'query_memory' | 'request_human_input';

export class AgentRegistry {
	private readonly agents = new Map<string, AgentDefinition>();

	constructor() {
		this.registerBuiltInAgents();
	}

	registerAgent(definition: AgentDefinition): void {
		this.agents.set(definition.id, definition);
	}

	getAgent(id: string): AgentDefinition | undefined {
		return this.agents.get(id);
	}

	getAllAgents(): AgentDefinition[] {
		return Array.from(this.agents.values());
	}

	private registerBuiltInAgents(): void {
		// Register Orchestrator Agent
		this.registerAgent({
			id: 'orchestrator',
			name: 'Orchestrator',
			description: 'Plans, delegates, coordinates all other agents',
			systemPrompt: 'You are the Orchestrator. You decompose complex user requests into structured tasks and direct specialized agents.',
			capabilities: ['read_file', 'call_ai', 'spawn_agent', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'gpt-4o', fallback: 'claude-sonnet', reason: 'High orchestrational intelligence and planning capabilities' },
			maxConcurrentTasks: 5,
			priority: 10,
			canSpawnSubAgents: true,
			inputTypes: ['TASK_ASSIGN', 'TASK_COMPLETE', 'TASK_FAILED', 'TASK_BLOCKED', 'FINDING_REPORT', 'STATUS_UPDATE', 'HUMAN_INPUT_NEEDED'],
			outputTypes: ['TASK_ASSIGN', 'AGENT_SPAWN_REQUEST', 'HUMAN_INPUT_NEEDED'],
			tools: ['read_file', 'send_message', 'query_memory', 'request_human_input']
		});

		// Register Planner Agent
		this.registerAgent({
			id: 'planner',
			name: 'Planner Agent',
			description: 'Breaks tasks into subtasks',
			systemPrompt: 'You are the Planner Agent. You create detailed dependency DAGs for the Orchestrator, estimating complexity and checkpoints.',
			capabilities: ['read_file', 'call_ai', 'send_message', 'read_memory'],
			preferredModel: { primary: 'gpt-4o', fallback: 'claude-sonnet', reason: 'Precise planning output' },
			maxConcurrentTasks: 1,
			priority: 9,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'query_memory']
		});

		// Register Architect Agent
		this.registerAgent({
			id: 'architect',
			name: 'Architect Agent',
			description: 'System design, file structure decisions',
			systemPrompt: 'You are the Architect. You think about long-term maintainability, ADR generation, and file design tradeoffs.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'Strong code design and architectural patterns understanding' },
			maxConcurrentTasks: 1,
			priority: 8,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT', 'MEMORY_STORE'],
			tools: ['read_file', 'search_codebase', 'create_annotation']
		});

		// Register Legacy Coder Agent (for backward compatibility)
		this.registerAgent({
			id: 'coder',
			name: 'Coder Agent',
			description: 'Writes and modifies code',
			systemPrompt: 'You are the Coder. You implement features matching the styling of the codebase, ensuring high code quality and strict error handling.',
			capabilities: ['read_file', 'write_file', 'create_file', 'delete_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Superior code writing speed and syntax correctness' },
			maxConcurrentTasks: 2,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'run_command', 'run_tests', 'search_codebase']
		});

		// Register Legacy Tester Agent (for backward compatibility)
		this.registerAgent({
			id: 'tester',
			name: 'Tester Agent',
			description: 'Writes and runs tests',
			systemPrompt: 'You are the Tester. You write robust unit/integration tests and verify coverage.',
			capabilities: ['read_file', 'write_file', 'create_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Good at generating boilerplate test suites and running checks' },
			maxConcurrentTasks: 2,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TEST_REQUESTED'],
			outputTypes: ['TEST_RESULT'],
			tools: ['read_file', 'write_file', 'create_file', 'run_tests']
		});

		// Register Legacy Reviewer Agent (for backward compatibility)
		this.registerAgent({
			id: 'reviewer',
			name: 'Reviewer Agent',
			description: 'Reviews code written by Coder',
			systemPrompt: 'You are the Reviewer. You audit code for bugs, style match, security, test gaps, and proper naming.',
			capabilities: ['read_file', 'call_ai', 'send_message', 'read_memory'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'High precision and detail-oriented code auditing' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['REVIEW_REQUESTED'],
			outputTypes: ['REVIEW_COMPLETE'],
			tools: ['read_file', 'create_annotation']
		});

		// Register Legacy Debugger Agent (for backward compatibility)
		this.registerAgent({
			id: 'debugger',
			name: 'Debugger Agent',
			description: 'Analyzes errors and fixes bugs',
			systemPrompt: 'You are the Debugger. You analyze stack traces, construct hypotheses, write reproductions, and recommend fixes.',
			capabilities: ['read_file', 'write_file', 'run_tests', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Fast debugging iteration and code fixing capabilities' },
			maxConcurrentTasks: 2,
			priority: 8,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN', 'TASK_FAILED'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE'],
			tools: ['read_file', 'write_file', 'run_command', 'run_tests', 'search_codebase']
		});

		// Register Backend Coder Agent
		this.registerAgent({
			id: 'backend-coder',
			name: 'Backend Coder Agent',
			description: 'Specializes in REST APIs, GraphQL, WebSockets, background jobs, database layers, auth systems',
			systemPrompt: 'You are the Backend Coder. You write complete, solid backend code in the project\'s existing framework, matching the style and checking lint and types.',
			capabilities: ['read_file', 'write_file', 'create_file', 'delete_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Superior logic and backend implementation' },
			maxConcurrentTasks: 2,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'run_command', 'search_codebase']
		});

		// Register Frontend Coder Agent
		this.registerAgent({
			id: 'frontend-coder',
			name: 'Frontend Coder Agent',
			description: 'Specializes in React, Vue, Svelte, vanilla JS, CSS, accessibility',
			systemPrompt: 'You are the Frontend Coder. You write responsive, clean component markup with ARIA accessibility tags and clean responsive CSS.',
			capabilities: ['read_file', 'write_file', 'create_file', 'delete_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Strong UI/UX markup implementation' },
			maxConcurrentTasks: 2,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'search_codebase']
		});

		// Register Database Agent
		this.registerAgent({
			id: 'database-agent',
			name: 'Database Agent',
			description: 'Specializes in schema design, migrations, query optimization, indexing',
			systemPrompt: 'You are the Database Agent. You write safe, reversible migrations, analyze queries, and never drop columns/tables without approval.',
			capabilities: ['read_file', 'write_file', 'create_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Precise SQL/ORM query structuring' },
			maxConcurrentTasks: 1,
			priority: 8,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'run_command', 'search_codebase']
		});

		// Register API Integration Agent
		this.registerAgent({
			id: 'api-integration',
			name: 'API Integration Agent',
			description: 'Specializes in integrating third-party APIs (Stripe, Twilio, SendGrid, AWS, etc.)',
			systemPrompt: 'You are the API Integration Agent. You build rate-limit-aware, resilient wrappers with exponential backoff and correct credential usage.',
			capabilities: ['read_file', 'write_file', 'create_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Experienced with external SDK structures' },
			maxConcurrentTasks: 2,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'search_codebase']
		});

		// Register Algorithm Agent
		this.registerAgent({
			id: 'algorithm-agent',
			name: 'Algorithm Agent',
			description: 'Specializes in data structures, algorithms, computational complexity',
			systemPrompt: 'You are the Algorithm Agent. You analyze Big-O complexity, select optimal computational pathways, and write benchmarks.',
			capabilities: ['read_file', 'write_file', 'create_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'High algorithmic math skills' },
			maxConcurrentTasks: 1,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'search_codebase']
		});

		// Register CLI Agent
		this.registerAgent({
			id: 'cli-agent',
			name: 'CLI Agent',
			description: 'Specializes in command-line tools, shell scripts, build tools, task runners',
			systemPrompt: 'You are the CLI Agent. You write POSIX-compliant scripts, handle exit codes, help instructions, dry runs, and verbose modes.',
			capabilities: ['read_file', 'write_file', 'create_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'CLI/Shell compatibility design' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'run_command']
		});

		// Register Configuration Agent
		this.registerAgent({
			id: 'config-agent',
			name: 'Configuration Agent',
			description: 'Manages package.json, tsconfig.json, eslint, webpack, vite, docker, etc.',
			systemPrompt: 'You are the Configuration Agent. You maintain configuration files and ensure consistency, parsing and validating them after every write.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message', 'read_memory', 'write_memory'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Reliable package/config JSON formatting' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Unit Test Agent
		this.registerAgent({
			id: 'unit-tester',
			name: 'Unit Test Agent',
			description: 'Writes unit tests targeting 90%+ line coverage with mocks',
			systemPrompt: 'You are the Unit Test Agent. You analyze targets, mock external services, and write exhaustive unit tests covering happy and edge paths.',
			capabilities: ['read_file', 'write_file', 'create_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Excellent test coverage generator' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TEST_REQUESTED'],
			outputTypes: ['TEST_RESULT'],
			tools: ['read_file', 'write_file', 'create_file', 'run_tests']
		});

		// Register Integration Test Agent
		this.registerAgent({
			id: 'integration-tester',
			name: 'Integration Test Agent',
			description: 'Writes end-to-end integration tests using test databases and seeding',
			systemPrompt: 'You are the Integration Test Agent. You write integration workflows, mock nothing except boundaries, and clean up test data.',
			capabilities: ['read_file', 'write_file', 'create_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Complex testing flow design' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TEST_REQUESTED'],
			outputTypes: ['TEST_RESULT'],
			tools: ['read_file', 'write_file', 'create_file', 'run_tests']
		});

		// Register E2E Test Agent
		this.registerAgent({
			id: 'e2e-tester',
			name: 'E2E Test Agent',
			description: 'Writes Playwright or Cypress tests, capturing screenshots on failure',
			systemPrompt: 'You are the E2E Test Agent. You write multi-viewport, browser-agnostic frontend automation scenarios.',
			capabilities: ['read_file', 'write_file', 'create_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Experienced with Playwright/Cypress locators' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TEST_REQUESTED'],
			outputTypes: ['TEST_RESULT'],
			tools: ['read_file', 'write_file', 'create_file', 'run_tests']
		});

		// Register Performance Test Agent
		this.registerAgent({
			id: 'performance-tester',
			name: 'Performance Test Agent',
			description: 'Writes load tests using k6 or Artillery, profiling CPU/memory',
			systemPrompt: 'You are the Performance Test Agent. You define ramp-up schedules, spike tests, measures latency percentiles and alerts regressions.',
			capabilities: ['read_file', 'write_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'k6 test scripting skill' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TEST_REQUESTED'],
			outputTypes: ['TEST_RESULT'],
			tools: ['read_file', 'write_file', 'run_tests']
		});

		// Register Mutation Test Agent
		this.registerAgent({
			id: 'mutation-tester',
			name: 'Mutation Test Agent',
			description: 'Flipped operator mutant testing, reporting mutation score',
			systemPrompt: 'You are the Mutation Test Agent. You generate mutants, run tests, score them, and advice coverage improvements.',
			capabilities: ['read_file', 'write_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'High logic analyzer' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TEST_REQUESTED'],
			outputTypes: ['TEST_RESULT'],
			tools: ['read_file', 'write_file', 'run_tests']
		});

		// Register Accessibility Agent
		this.registerAgent({
			id: 'accessibility-tester',
			name: 'Accessibility Agent',
			description: 'Checks HTML/JSX for WCAG 2.1 AA violations using axe-core',
			systemPrompt: 'You are the Accessibility Agent. You scan templates for missing alt-tags, aria roles, keyboard focus traps, and write fixes.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Excellent knowledge of aria-specifications' },
			maxConcurrentTasks: 2,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Cross-Browser Agent
		this.registerAgent({
			id: 'cross-browser-tester',
			name: 'Cross-Browser Agent',
			description: 'Tests compatibility, checks CSS properties and adds polyfills',
			systemPrompt: 'You are the Cross-Browser Agent. You review compat metrics, prefix styles, and resolve browser-specific API gaps.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Browser API compatibility index knowledge' },
			maxConcurrentTasks: 2,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Regression Guard Agent
		this.registerAgent({
			id: 'regression-guard',
			name: 'Regression Guard Agent',
			description: 'Runs test suite, bisects failure commits, and proposes fixes',
			systemPrompt: 'You are the Regression Guard. You ensure no existing test fails, identify blame agents, and formulate rollback PRs.',
			capabilities: ['read_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'High reliability in test diagnosis' },
			maxConcurrentTasks: 1,
			priority: 8,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'run_tests']
		});

		// Register OWASP Agent
		this.registerAgent({
			id: 'security-owasp',
			name: 'OWASP Agent',
			description: 'Checks code against OWASP Top 10 vulnerabilities',
			systemPrompt: 'You are the OWASP Agent. You analyze input/output pathways for XSS, SQL injection, CSRF, and force rejection on violations.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'Zero-tolerance security auditing' },
			maxConcurrentTasks: 2,
			priority: 8,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase', 'create_annotation']
		});

		// Register Secrets Scanner Agent
		this.registerAgent({
			id: 'secrets-scanner',
			name: 'Secrets Scanner Agent',
			description: 'Scans code and git history for committed secrets and high-entropy strings',
			systemPrompt: 'You are the Secrets Scanner. You search for API keys, private keys, block commits, and purge history if leaked.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'High precision entropy scanner' },
			maxConcurrentTasks: 2,
			priority: 8,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase']
		});

		// Register Dependency Audit Agent
		this.registerAgent({
			id: 'dependency-audit',
			name: 'Dependency Audit Agent',
			description: 'Continuously audits packages against vulnerability CVE databases',
			systemPrompt: 'You are the Dependency Auditor. You run dependency check commands, evaluate CVE severity, and auto-upgrade patches.',
			capabilities: ['read_file', 'write_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Precise version matching' },
			maxConcurrentTasks: 1,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'run_command']
		});

		// Register Penetration Test Agent
		this.registerAgent({
			id: 'pen-tester',
			name: 'Penetration Test Agent',
			description: 'Attempts fuzzing and exploit simulations locally',
			systemPrompt: 'You are the Penetration Tester. You fuzz input ranges, mock auth bypasses, test path traversals, and compile POCs.',
			capabilities: ['read_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'Creative exploit generation logic' },
			maxConcurrentTasks: 1,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'run_command']
		});

		// Register Compliance Agent
		this.registerAgent({
			id: 'compliance-agent',
			name: 'Compliance Agent',
			description: 'Checks GDPR, HIPAA, SOC2 compliance on data handles',
			systemPrompt: 'You are the Compliance Agent. You audit PII logs, encryption limits, audit trails, and output checklists.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'High legal/compliance guideline parsing capability' },
			maxConcurrentTasks: 1,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase', 'create_annotation']
		});

		// Register Infrastructure Security Agent
		this.registerAgent({
			id: 'infra-security',
			name: 'Infrastructure Security Agent',
			description: 'Reviews Dockerfile, K8s manifests, and TLS configs',
			systemPrompt: 'You are the Infra Security Agent. You flag root containers, exposed ENV secrets, broad CORS rules, and weak cipher parameters.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-opus', fallback: 'gpt-4o', reason: 'Docker/K8s/Terraform security specialist' },
			maxConcurrentTasks: 2,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase']
		});

		// Register Performance Profiler Agent
		this.registerAgent({
			id: 'perf-profiler',
			name: 'Performance Profiler Agent',
			description: 'Reads profilers, analyzes flamegraphs, suggests optimizations',
			systemPrompt: 'You are the Performance Profiler. You suggest lazy loadings, caching, algorithm changes, and compute gains.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Flamegraph parsing efficiency' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase']
		});

		// Register Bundle Optimizer Agent (Frontend)
		this.registerAgent({
			id: 'bundle-optimizer',
			name: 'Bundle Optimizer Agent',
			description: 'Analyzes build bundles, tree-shakes, targets <200KB JS',
			systemPrompt: 'You are the Bundle Optimizer. You restructure imports, suggest code splitting, dynamic imports, and target bundle weight minimization.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Deep Webpack/Vite analyzer' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Database Query Optimizer Agent
		this.registerAgent({
			id: 'db-query-optimizer',
			name: 'Database Query Optimizer Agent',
			description: 'Analyzes slow query logs, writes indexes, rewrites queries',
			systemPrompt: 'You are the Database Query Optimizer. You verify query plans, suggest missing indexes, and prevent ORM N+1 issues.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'SQL EXPLAIN analyst' },
			maxConcurrentTasks: 1,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Memory Leak Hunter Agent
		this.registerAgent({
			id: 'memory-leak-hunter',
			name: 'Memory Leak Hunter Agent',
			description: 'Searches event listeners, unclosed streams, and closures',
			systemPrompt: 'You are the Memory Leak Hunter. You inspect component cleanups, connection pool releases, and instrument profiles.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Static analysis for memory leak patterns' },
			maxConcurrentTasks: 1,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase']
		});

		// Register Caching Strategy Agent
		this.registerAgent({
			id: 'caching-strategy',
			name: 'Caching Strategy Agent',
			description: 'Implements redis/in-memory/CDN caching with stampede locks',
			systemPrompt: 'You are the Caching Strategy Agent. You define cache keys, TTL configurations, headers, and invalidation structures.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'High caching pattern experience' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Inline Doc Agent
		this.registerAgent({
			id: 'inline-doc',
			name: 'Inline Doc Agent',
			description: 'Writes JSDoc/TSDoc/PyDoc for functions and classes',
			systemPrompt: 'You are the Inline Doc Agent. You write accurate params, returns, throws, examples matching style.',
			capabilities: ['read_file', 'write_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-haiku', fallback: 'claude-sonnet', reason: 'Clear documentation summarization' },
			maxConcurrentTasks: 3,
			priority: 4,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file']
		});

		// Register README Agent
		this.registerAgent({
			id: 'readme-agent',
			name: 'README Agent',
			description: 'Generates and maintains the project README with Kyvora badge',
			systemPrompt: 'You are the README Agent. You write operational instructions, tech stack lists, and place Kyvora badge at the top.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-haiku', fallback: 'claude-sonnet', reason: 'Strong readme outline writing' },
			maxConcurrentTasks: 1,
			priority: 4,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register API Docs Agent
		this.registerAgent({
			id: 'api-docs',
			name: 'API Docs Agent',
			description: 'Generates OpenAPI specs from endpoint definitions',
			systemPrompt: 'You are the API Docs Agent. You read routes, generate Swagger UI endpoints, schema variables and keep specs in sync.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-haiku', fallback: 'claude-sonnet', reason: 'OpenAPI specification knowledge' },
			maxConcurrentTasks: 2,
			priority: 4,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register Architecture Docs Agent
		this.registerAgent({
			id: 'arch-docs',
			name: 'Architecture Docs Agent',
			description: 'Maintains architectural Mermaid diagrams and ADR logs',
			systemPrompt: 'You are the Architecture Docs Agent. You update deployment contexts, ADR files, and Mermaid diagrams.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-haiku', fallback: 'claude-sonnet', reason: 'Experienced with Mermaid block layout' },
			maxConcurrentTasks: 1,
			priority: 4,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register Changelog Agent
		this.registerAgent({
			id: 'changelog-agent',
			name: 'Changelog Agent',
			description: 'Compiles CHANGELOG.md based on conventional commits',
			systemPrompt: 'You are the Changelog Agent. You read git history, organize features/fixes/breaking categories, and draft releases.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-haiku', fallback: 'claude-sonnet', reason: 'Conventional commit mapping specialist' },
			maxConcurrentTasks: 1,
			priority: 4,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register Docker Agent
		this.registerAgent({
			id: 'docker-agent',
			name: 'Docker Agent',
			description: 'Writes optimized, secure, multi-stage Dockerfiles',
			systemPrompt: 'You are the Docker Agent. You structure layer caching, non-root users, healthchecks, and dev compose environments.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Docker configuration experience' },
			maxConcurrentTasks: 2,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register CI/CD Agent
		this.registerAgent({
			id: 'cicd-agent',
			name: 'CI/CD Agent',
			description: 'Writes GitHub Actions, GitLab CI pipelines with caching',
			systemPrompt: 'You are the CI/CD Agent. You write pipeline matrices, parallel testing pipelines, lint steps, and rollback routines.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'GitHub Actions / GitLab CI syntax expert' },
			maxConcurrentTasks: 2,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register Infrastructure as Code Agent
		this.registerAgent({
			id: 'iac-agent',
			name: 'Infrastructure as Code Agent',
			description: 'Writes Terraform or Pulumi configurations with workspace modules',
			systemPrompt: 'You are the IaC Agent. You manage S3 tfstates, provision databases, CDNs, and calculate resource costs.',
			capabilities: ['read_file', 'write_file', 'create_file', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Terraform configuration skills' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file']
		});

		// Register Monitoring Agent
		this.registerAgent({
			id: 'monitoring-agent',
			name: 'Monitoring Agent',
			description: 'Injects OpenTelemetry traces, Prometheus metrics, and alerts',
			systemPrompt: 'You are the Monitoring Agent. You write Grafana dashboard JSON configurations, setup alert limits, and add structured logging.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Telemetry and Grafana setup specialist' },
			maxConcurrentTasks: 2,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Database Migration Agent
		this.registerAgent({
			id: 'db-migration',
			name: 'Database Migration Agent',
			description: 'Coordinates reversible database migrations with validation tests',
			systemPrompt: 'You are the Database Migration Agent. You test migration plans, rollback scripts, and prevent out-of-order changes.',
			capabilities: ['read_file', 'write_file', 'create_file', 'run_tests', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Experienced with database state lifecycles' },
			maxConcurrentTasks: 1,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'create_file', 'run_command', 'run_tests']
		});

		// Register Code Pattern Agent
		this.registerAgent({
			id: 'code-pattern',
			name: 'Code Pattern Agent',
			description: 'Maintains codebase design libraries and warns on pattern divergences',
			systemPrompt: 'You are the Code Pattern Agent. You evaluate code against project templates, outline deviations, and write templates to .kyvora/patterns/.',
			capabilities: ['read_file', 'write_file', 'create_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Excellent pattern matching intelligence' },
			maxConcurrentTasks: 1,
			priority: 6,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT', 'TASK_COMPLETE'],
			tools: ['read_file', 'write_file', 'create_file', 'search_codebase']
		});

		// Register Tech Debt Agent
		this.registerAgent({
			id: 'tech-debt',
			name: 'Tech Debt Agent',
			description: 'Scores technical debt based on impact/effort and lists suggestions',
			systemPrompt: 'You are the Tech Debt Agent. You score technical debt items, write TECH_DEBT.md, and formulate repayment structures.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'High code smell analysis capability' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT', 'TASK_COMPLETE'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Dependency Intelligence Agent
		this.registerAgent({
			id: 'dependency-intel',
			name: 'Dependency Intelligence Agent',
			description: 'Evaluates outdated, abandoned, or redundant dependency packages',
			systemPrompt: 'You are the Dependency Intelligence Agent. You track package freshness, suggest safe modern alternatives, and clean unused imports.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Comprehensive package ecosystem knowledge' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Code Search Agent
		this.registerAgent({
			id: 'code-search',
			name: 'Code Search Agent',
			description: 'Provides semantic and AST codebase search capabilities',
			systemPrompt: 'You are the Code Search Agent. You parse structural components, query databases, and build Orchestrator query context.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'AST-based search understanding' },
			maxConcurrentTasks: 3,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase']
		});

		// Register Mobile Agent
		this.registerAgent({
			id: 'mobile-agent',
			name: 'Mobile Agent',
			description: 'Runs when React Native, Flutter, Swift, or Kotlin code is present',
			systemPrompt: 'You are the Mobile Agent. You manage mobile navigation, offline support, touch target sizes, and cross-platform mobile differences.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Mobile framework experience' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Machine Learning Agent
		this.registerAgent({
			id: 'ml-agent',
			name: 'Machine Learning Agent',
			description: 'Manages model versioning, training pipelines, and reproducibility',
			systemPrompt: 'You are the Machine Learning Agent. You write training scripts with seed control, model architectures, and preprocessing pipelines.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'PyTorch/TensorFlow script writing skills' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register Internationalization Agent (i18n)
		this.registerAgent({
			id: 'i18n-agent',
			name: 'Internationalization Agent',
			description: 'Extracts hardcoded strings, manages language JSON translation catalogs',
			systemPrompt: 'You are the i18n Agent. You translate text catalogs, check RTL formats, and wrap UI elements in locale helpers.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Excellent language translation and formatting' },
			maxConcurrentTasks: 2,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register WebAssembly Agent
		this.registerAgent({
			id: 'wasm-agent',
			name: 'WebAssembly Agent',
			description: 'Rewrites performance-critical functions to Rust/C compiled to WASM',
			systemPrompt: 'You are the WASM Agent. You benchmark JS vs WASM executions, manage linear memory, and write clean WebAssembly logic wrappers.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Rust/C compile-to-wasm expert' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE', 'TASK_FAILED'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});

		// Register legacy searcher & refactor for backward compatibility
		this.registerAgent({
			id: 'searcher',
			name: 'Search Agent',
			description: 'Legacy search agent',
			systemPrompt: 'You are the Search Agent. You locate relevant libraries, APIs, existing code patterns, and external documentation.',
			capabilities: ['read_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'gemini-ultra', fallback: 'gpt-4o', reason: 'Search queries' },
			maxConcurrentTasks: 3,
			priority: 7,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['FINDING_REPORT'],
			tools: ['read_file', 'search_codebase']
		});

		this.registerAgent({
			id: 'refactor',
			name: 'Refactor Agent',
			description: 'Legacy refactor agent',
			systemPrompt: 'You are the Refactor Agent. You modularize code, extract services, break down huge functions, and clean up technical debt.',
			capabilities: ['read_file', 'write_file', 'search_codebase', 'call_ai', 'send_message'],
			preferredModel: { primary: 'claude-sonnet', fallback: 'gpt-4o', reason: 'Refactoring' },
			maxConcurrentTasks: 1,
			priority: 5,
			canSpawnSubAgents: false,
			inputTypes: ['TASK_ASSIGN'],
			outputTypes: ['CODE_PRODUCED', 'TASK_COMPLETE'],
			tools: ['read_file', 'write_file', 'search_codebase']
		});
	}
}
