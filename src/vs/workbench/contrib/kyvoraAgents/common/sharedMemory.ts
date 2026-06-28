/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IDisposable } from '../../../../base/common/lifecycle.js';
import { Emitter } from '../../../../base/common/event.js';
import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';

export interface MemoryMetadata {
	agentId: string;
	timestamp: number;
	type: 'finding' | 'decision' | 'code' | 'plan' | 'error' | 'note';
	fileRefs: string[];       // which files this memory relates to
	taskId?: string;          // which task produced this memory
	confidence: number;       // 0-1
	expiresAfterMs?: number;  // auto-delete after this
}

export interface SemanticMemoryResult {
	id: string;
	content: string;
	metadata: MemoryMetadata;
	relevance: number;
}

export interface AgentEvent {
	id: string;
	sessionId: string;
	agentId: string;
	timestamp: number;
	eventType: string;
	description: string;
	payload?: any;
}

export interface BlackboardEntry {
	topic: string;
	content: string;
	author: string;
	timestamp: number;
}

export interface SharedMemory {
	working: {
		set(key: string, value: unknown, ttl?: number): void;
		get(key: string): unknown;
		delete(key: string): void;
		list(prefix?: string): string[];
	};

	semantic: {
		store(content: string, metadata: MemoryMetadata): Promise<string>;
		search(query: string, topK?: number): Promise<SemanticMemoryResult[]>;
		delete(id: string): Promise<void>;
		update(id: string, content: string): Promise<void>;
	};

	episodic: {
		record(event: AgentEvent): void;
		recall(query: string, limit?: number): AgentEvent[];
		getSessionHistory(sessionId: string): AgentEvent[];
	};

	blackboard: {
		post(topic: string, content: string, author: string): void;
		read(topic: string): BlackboardEntry[];
		subscribe(topic: string, callback: (entry: BlackboardEntry) => void): IDisposable;
	};
}

export class KyvoraSharedMemory implements SharedMemory {
	private readonly workingMap = new Map<string, { value: unknown; expiresAt?: number }>();
	private readonly blackboardEntries = new Map<string, BlackboardEntry[]>();
	private readonly blackboardEmitter = new Emitter<{ topic: string; entry: BlackboardEntry }>();

	private semanticStore: { id: string; content: string; metadata: MemoryMetadata }[] = [];
	private episodicLog: AgentEvent[] = [];

	constructor(
		private readonly storageService: IStorageService
	) {
		this.initializeStorage();
	}

	private initializeStorage(): void {
		try {
			const semanticData = this.storageService.get('kyvora.agents.semantic', StorageScope.WORKSPACE);
			if (semanticData) {
				this.semanticStore = JSON.parse(semanticData);
			}
			const episodicData = this.storageService.get('kyvora.agents.episodic', StorageScope.WORKSPACE);
			if (episodicData) {
				this.episodicLog = JSON.parse(episodicData);
			}
		} catch (e) {
			console.error('Error initializing Kyvora Agents storage:', e);
		}
	}

	private saveSemantic(): void {
		try {
			this.storageService.store('kyvora.agents.semantic', JSON.stringify(this.semanticStore), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		} catch (e) {
			console.error('Error saving semantic store:', e);
		}
	}

	private saveEpisodic(): void {
		try {
			this.storageService.store('kyvora.agents.episodic', JSON.stringify(this.episodicLog), StorageScope.WORKSPACE, StorageTarget.MACHINE);
		} catch (e) {
			console.error('Error saving episodic log:', e);
		}
	}

	// Working memory implementation
	readonly working = {
		set: (key: string, value: unknown, ttl?: number): void => {
			const expiresAt = ttl ? Date.now() + ttl : undefined;
			this.workingMap.set(key, { value, expiresAt });
		},
		get: (key: string): unknown => {
			const item = this.workingMap.get(key);
			if (!item) {
				return undefined;
			}
			if (item.expiresAt && Date.now() > item.expiresAt) {
				this.workingMap.delete(key);
				return undefined;
			}
			return item.value;
		},
		delete: (key: string): void => {
			this.workingMap.delete(key);
		},
		list: (prefix?: string): string[] => {
			const keys = Array.from(this.workingMap.keys());
			// Clean expired keys on list
			for (const key of keys) {
				const item = this.workingMap.get(key);
				if (item?.expiresAt && Date.now() > item.expiresAt) {
					this.workingMap.delete(key);
				}
			}
			const activeKeys = Array.from(this.workingMap.keys());
			return prefix ? activeKeys.filter(k => k.startsWith(prefix)) : activeKeys;
		}
	};

	// Semantic memory (light search using token matching/TF-IDF similarity)
	readonly semantic = {
		store: async (content: string, metadata: MemoryMetadata): Promise<string> => {
			const id = Math.random().toString(36).substring(2, 15);
			this.semanticStore.push({ id, content, metadata });
			this.saveSemantic();
			return id;
		},
		search: async (query: string, topK: number = 5): Promise<SemanticMemoryResult[]> => {
			const queryTokens = query.toLowerCase().split(/\s+/).filter(Boolean);
			if (queryTokens.length === 0) {
				return [];
			}

			const results: SemanticMemoryResult[] = this.semanticStore.map(item => {
				const contentLower = item.content.toLowerCase();
				let matchCount = 0;
				for (const token of queryTokens) {
					if (contentLower.includes(token)) {
						matchCount++;
					}
				}
				const relevance = matchCount / queryTokens.length;
				return { ...item, relevance };
			});

			return results
				.filter(r => r.relevance > 0)
				.sort((a, b) => b.relevance - a.relevance)
				.slice(0, topK);
		},
		delete: async (id: string): Promise<void> => {
			this.semanticStore = this.semanticStore.filter(item => item.id !== id);
			this.saveSemantic();
		},
		update: async (id: string, content: string): Promise<void> => {
			const item = this.semanticStore.find(item => item.id === id);
			if (item) {
				item.content = content;
				this.saveSemantic();
			}
		}
	};

	// Episodic memory implementation
	readonly episodic = {
		record: (event: AgentEvent): void => {
			this.episodicLog.push(event);
			this.saveEpisodic();
		},
		recall: (query: string, limit: number = 10): AgentEvent[] => {
			const queryLower = query.toLowerCase();
			return this.episodicLog
				.filter(event => event.description.toLowerCase().includes(queryLower) ||
					(event.eventType && event.eventType.toLowerCase().includes(queryLower)))
				.slice(-limit);
		},
		getSessionHistory: (sessionId: string): AgentEvent[] => {
			return this.episodicLog.filter(event => event.sessionId === sessionId);
		}
	};

	// Blackboard implementation
	readonly blackboard = {
		post: (topic: string, content: string, author: string): void => {
			const entry: BlackboardEntry = { topic, content, author, timestamp: Date.now() };
			if (!this.blackboardEntries.has(topic)) {
				this.blackboardEntries.set(topic, []);
			}
			this.blackboardEntries.get(topic)!.push(entry);
			this.blackboardEmitter.fire({ topic, entry });
		},
		read: (topic: string): BlackboardEntry[] => {
			return this.blackboardEntries.get(topic) || [];
		},
		subscribe: (topic: string, callback: (entry: BlackboardEntry) => void): IDisposable => {
			return this.blackboardEmitter.event((event: { topic: string; entry: BlackboardEntry }) => {
				if (event.topic === topic || topic === '*') {
					callback(event.entry);
				}
			});
		}
	};
}
