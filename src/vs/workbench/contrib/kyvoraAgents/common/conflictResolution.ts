/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { Emitter, Event } from '../../../../base/common/event.js';
import { Disposable } from '../../../../base/common/lifecycle.js';

/**
 * Represents a conflict where two agents attempt to modify the same file.
 */
export interface FileConflict {
	id: string;
	filePath: string;
	agent1Id: string;
	agent1Content: string;
	agent2Id: string;
	agent2Content: string;
	timestamp: number;
	resolution?: ConflictResolutionStrategy;
	resolvedContent?: string;
}

export type ConflictResolutionStrategy =
	| 'agent1_wins'       // first agent's version wins
	| 'agent2_wins'       // second agent's version wins
	| 'merge'             // attempt automatic merge
	| 'human_decision'    // ask user
	| 'priority_based';   // higher-priority agent wins

/**
 * Tracks file locks and ownership during multi-agent editing sessions.
 */
export interface FileLock {
	filePath: string;
	lockedBy: string;     // agentId
	lockedAt: number;
	expiresAt: number;    // auto-expire after timeout
	taskId?: string;
}

export class ConflictResolutionService extends Disposable {

	private readonly _onConflictDetected = this._register(new Emitter<FileConflict>());
	readonly onConflictDetected: Event<FileConflict> = this._onConflictDetected.event;

	private readonly _onConflictResolved = this._register(new Emitter<FileConflict>());
	readonly onConflictResolved: Event<FileConflict> = this._onConflictResolved.event;

	private readonly fileLocks = new Map<string, FileLock>();
	private readonly pendingConflicts = new Map<string, FileConflict>();
	private readonly agentPriorities = new Map<string, number>();

	constructor() {
		super();
		this.setDefaultPriorities();
	}

	private setDefaultPriorities(): void {
		this.agentPriorities.set('orchestrator', 10);
		this.agentPriorities.set('architect', 8);
		this.agentPriorities.set('debugger', 8);
		this.agentPriorities.set('coder', 7);
		this.agentPriorities.set('reviewer', 6);
		this.agentPriorities.set('security', 6);
		this.agentPriorities.set('tester', 5);
		this.agentPriorities.set('performance', 5);
		this.agentPriorities.set('refactor', 5);
		this.agentPriorities.set('doc_writer', 4);
		this.agentPriorities.set('searcher', 7);
		this.agentPriorities.set('planner', 9);
	}

	/**
	 * Attempt to acquire a file lock for an agent before writing.
	 */
	acquireLock(filePath: string, agentId: string, taskId?: string, ttlMs: number = 30000): boolean {
		this.cleanExpiredLocks();

		const existing = this.fileLocks.get(filePath);
		if (existing && existing.lockedBy !== agentId) {
			// Lock held by another agent
			return false;
		}

		this.fileLocks.set(filePath, {
			filePath,
			lockedBy: agentId,
			lockedAt: Date.now(),
			expiresAt: Date.now() + ttlMs,
			taskId
		});
		return true;
	}

	/**
	 * Release a file lock held by an agent.
	 */
	releaseLock(filePath: string, agentId: string): void {
		const lock = this.fileLocks.get(filePath);
		if (lock && lock.lockedBy === agentId) {
			this.fileLocks.delete(filePath);
		}
	}

	/**
	 * Release all locks held by a specific agent (e.g. after agent finishes/dies).
	 */
	releaseAllLocks(agentId: string): void {
		for (const [path, lock] of this.fileLocks) {
			if (lock.lockedBy === agentId) {
				this.fileLocks.delete(path);
			}
		}
	}

	/**
	 * Check if a file is currently locked and who holds it.
	 */
	getLockInfo(filePath: string): FileLock | undefined {
		this.cleanExpiredLocks();
		return this.fileLocks.get(filePath);
	}

	/**
	 * Report a detected conflict between two agent writes.
	 */
	reportConflict(
		filePath: string,
		agent1Id: string,
		agent1Content: string,
		agent2Id: string,
		agent2Content: string
	): FileConflict {
		const conflict: FileConflict = {
			id: `conflict-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
			filePath,
			agent1Id,
			agent1Content,
			agent2Id,
			agent2Content,
			timestamp: Date.now()
		};

		this.pendingConflicts.set(conflict.id, conflict);
		this._onConflictDetected.fire(conflict);
		return conflict;
	}

	/**
	 * Resolve a conflict using a specified strategy.
	 */
	resolveConflict(conflictId: string, strategy: ConflictResolutionStrategy): FileConflict | undefined {
		const conflict = this.pendingConflicts.get(conflictId);
		if (!conflict) {
			return undefined;
		}

		conflict.resolution = strategy;

		switch (strategy) {
			case 'agent1_wins':
				conflict.resolvedContent = conflict.agent1Content;
				break;

			case 'agent2_wins':
				conflict.resolvedContent = conflict.agent2Content;
				break;

			case 'priority_based': {
				const p1 = this.agentPriorities.get(conflict.agent1Id) || 0;
				const p2 = this.agentPriorities.get(conflict.agent2Id) || 0;
				conflict.resolvedContent = p1 >= p2 ? conflict.agent1Content : conflict.agent2Content;
				break;
			}

			case 'merge':
				conflict.resolvedContent = this.attemptMerge(conflict.agent1Content, conflict.agent2Content);
				break;

			case 'human_decision':
				// Content will be set later by human
				break;
		}

		this.pendingConflicts.delete(conflictId);
		this._onConflictResolved.fire(conflict);
		return conflict;
	}

	/**
	 * Auto-resolve using priority-based strategy.
	 */
	autoResolve(conflictId: string): FileConflict | undefined {
		return this.resolveConflict(conflictId, 'priority_based');
	}

	/**
	 * Get all pending (unresolved) conflicts.
	 */
	getPendingConflicts(): FileConflict[] {
		return Array.from(this.pendingConflicts.values());
	}

	/**
	 * Basic line-by-line merge attempt.
	 */
	private attemptMerge(content1: string, content2: string): string {
		const lines1 = content1.split('\n');
		const lines2 = content2.split('\n');
		const result: string[] = [];

		const maxLen = Math.max(lines1.length, lines2.length);
		for (let i = 0; i < maxLen; i++) {
			const l1 = lines1[i];
			const l2 = lines2[i];

			if (l1 === undefined) {
				result.push(l2);
			} else if (l2 === undefined) {
				result.push(l1);
			} else if (l1 === l2) {
				result.push(l1);
			} else {
				// Conflict marker
				result.push(`<<<<<<< Agent 1`);
				result.push(l1);
				result.push('=======');
				result.push(l2);
				result.push(`>>>>>>> Agent 2`);
			}
		}

		return result.join('\n');
	}

	/**
	 * Remove expired locks.
	 */
	private cleanExpiredLocks(): void {
		const now = Date.now();
		for (const [path, lock] of this.fileLocks) {
			if (lock.expiresAt < now) {
				this.fileLocks.delete(path);
			}
		}
	}
}
