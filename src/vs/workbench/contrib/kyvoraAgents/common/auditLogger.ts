/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';
import { VSBuffer } from '../../../../base/common/buffer.js';

export type AuditSeverity = 'info' | 'warning' | 'critical' | 'security';

export interface AuditEntry {
	id: string;
	timestamp: number;
	sessionId: string;
	agentId: string;
	action: string;
	details: string;
	severity: AuditSeverity;
	filePath?: string;
	command?: string;
	outcome: 'success' | 'blocked' | 'failed';
}

/**
 * Audit Logger for all agent actions.
 * Provides an immutable, append-only log for security compliance and debugging.
 * All file writes, command executions, and security-sensitive operations are recorded.
 */
export class AgentAuditLogger {
	private readonly logFileUri: URI;
	private readonly entries: AuditEntry[] = [];

	constructor(
		workspaceRootUri: URI,
		private readonly fileService: IFileService
	) {
		const logDirUri = URI.joinPath(workspaceRootUri, '.kyvora', 'audit');
		this.logFileUri = URI.joinPath(logDirUri, `audit-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`);
	}

	/**
	 * Log an agent action.
	 */
	log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): AuditEntry {
		const full: AuditEntry = {
			...entry,
			id: `audit-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
			timestamp: Date.now()
		};

		this.entries.push(full);
		this.persist(full);
		return full;
	}

	/**
	 * Log a file write operation.
	 */
	logFileWrite(sessionId: string, agentId: string, filePath: string, outcome: AuditEntry['outcome']): AuditEntry {
		return this.log({
			sessionId,
			agentId,
			action: 'FILE_WRITE',
			details: `Agent wrote to file: ${filePath}`,
			severity: 'info',
			filePath,
			outcome
		});
	}

	/**
	 * Log a file creation operation.
	 */
	logFileCreate(sessionId: string, agentId: string, filePath: string, outcome: AuditEntry['outcome']): AuditEntry {
		return this.log({
			sessionId,
			agentId,
			action: 'FILE_CREATE',
			details: `Agent created file: ${filePath}`,
			severity: 'info',
			filePath,
			outcome
		});
	}

	/**
	 * Log a command execution.
	 */
	logCommand(sessionId: string, agentId: string, command: string, outcome: AuditEntry['outcome']): AuditEntry {
		return this.log({
			sessionId,
			agentId,
			action: 'COMMAND_EXEC',
			details: `Agent executed command: ${command}`,
			severity: 'warning',
			command,
			outcome
		});
	}

	/**
	 * Log a security violation (sandbox breach attempt).
	 */
	logSecurityViolation(sessionId: string, agentId: string, details: string): AuditEntry {
		return this.log({
			sessionId,
			agentId,
			action: 'SECURITY_VIOLATION',
			details,
			severity: 'critical',
			outcome: 'blocked'
		});
	}

	/**
	 * Log a blocked operation (e.g. protected file, non-whitelisted command).
	 */
	logBlocked(sessionId: string, agentId: string, action: string, reason: string): AuditEntry {
		return this.log({
			sessionId,
			agentId,
			action: `BLOCKED_${action}`,
			details: reason,
			severity: 'security',
			outcome: 'blocked'
		});
	}

	/**
	 * Log agent spawning and lifecycle events.
	 */
	logAgentLifecycle(sessionId: string, agentId: string, event: 'started' | 'stopped' | 'crashed'): AuditEntry {
		return this.log({
			sessionId,
			agentId,
			action: `AGENT_${event.toUpperCase()}`,
			details: `Agent ${agentId} ${event}`,
			severity: event === 'crashed' ? 'critical' : 'info',
			outcome: event === 'crashed' ? 'failed' : 'success'
		});
	}

	/**
	 * Get recent audit entries, optionally filtered.
	 */
	getEntries(filter?: {
		agentId?: string;
		sessionId?: string;
		severity?: AuditSeverity;
		action?: string;
		limit?: number;
	}): AuditEntry[] {
		let result = [...this.entries];

		if (filter?.agentId) {
			result = result.filter(e => e.agentId === filter.agentId);
		}
		if (filter?.sessionId) {
			result = result.filter(e => e.sessionId === filter.sessionId);
		}
		if (filter?.severity) {
			result = result.filter(e => e.severity === filter.severity);
		}
		if (filter?.action) {
			result = result.filter(e => e.action === filter.action);
		}

		if (filter?.limit) {
			result = result.slice(-filter.limit);
		}

		return result;
	}

	/**
	 * Get a security report summary for a session.
	 */
	getSecurityReport(sessionId: string): {
		totalActions: number;
		blockedActions: number;
		securityViolations: number;
		fileWrites: number;
		commandExecs: number;
		byAgent: Map<string, number>;
	} {
		const sessionEntries = this.entries.filter(e => e.sessionId === sessionId);
		const byAgent = new Map<string, number>();

		for (const entry of sessionEntries) {
			byAgent.set(entry.agentId, (byAgent.get(entry.agentId) || 0) + 1);
		}

		return {
			totalActions: sessionEntries.length,
			blockedActions: sessionEntries.filter(e => e.outcome === 'blocked').length,
			securityViolations: sessionEntries.filter(e => e.action === 'SECURITY_VIOLATION').length,
			fileWrites: sessionEntries.filter(e => e.action === 'FILE_WRITE' || e.action === 'FILE_CREATE').length,
			commandExecs: sessionEntries.filter(e => e.action === 'COMMAND_EXEC').length,
			byAgent
		};
	}

	generateHtmlSecurityReport(sessionId: string): string {
		const summary = this.getSecurityReport(sessionId);
		const filteredEntries = this.entries.filter(e => e.sessionId === sessionId);

		const logoBase64 = "PHN2ZyB3aWR0aD0iODAiIGhlaWdodD0iOTIiIHZpZXdCb3g9IjAgMCA4MCA5MiIgZmlsbD0ibm9uZSIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj4KICA8cGF0aCBkPSJNNDAgMkw3Ni4zNiAyM1Y2NUw0MCA4NkwzLjY0IDY1VjIzTDQwIDJaIiBzdHJva2U9IiNhOThkZTgiIHN0cm9rZS13aWR0aD0iNCIgc3Ryb2tlLWxpbmVqb2luPSJyb3VuZCIvPgogIDxwYXRoIGQ9Ik00MCAxOEw2MS42NSAzMC41VjU1LjVMNDAgNjhMMTguMzUgNTUuNVYzMC41TDQwIDE4WiIgZmlsbD0iI2E5OGRlOCIgZmlsbC1vcGFjaXR5PSIwLjIiIHN0cm9rZT0iI2E5OGRlOCIgc3Ryb2tlLXdpZHRoPSIyIiBzdHJva2UtbGluZWpvaW49InJvdW5kIi8+CiAgPGNpcmNsZSBjeD0iNDAiIGN5PSI0MyIgcj0iMTAiIGZpbGw9IiNjOGI0ZjAiLz4KPC9zdmc+";

		let tableRows = '';
		for (const entry of filteredEntries) {
			const badgeClass = entry.severity === 'critical' || entry.severity === 'security' ? 'badge-danger' : entry.severity === 'warning' ? 'badge-warning' : 'badge-info';
			tableRows += `
				<tr>
					<td>${new Date(entry.timestamp).toLocaleTimeString()}</td>
					<td><span class="agent-name">${entry.agentId}</span></td>
					<td><strong>${entry.action}</strong></td>
					<td>${entry.details}</td>
					<td><span class="badge ${badgeClass}">${entry.severity}</span></td>
					<td><span class="outcome-${entry.outcome}">${entry.outcome}</span></td>
				</tr>
			`;
		}

		return `<!DOCTYPE html>
<html lang="en">
<head>
	<meta charset="UTF-8">
	<title>Kyvora Security Audit Report</title>
	<style>
		body {
			background-color: #0c0c0e;
			color: #e2e2e9;
			font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
			padding: 40px;
			margin: 0;
		}
		.container {
			max-width: 1100px;
			margin: 0 auto;
			background-color: #121216;
			border: 1px solid #202026;
			border-radius: 12px;
			padding: 30px;
			box-shadow: 0 8px 30px rgba(0, 0, 0, 0.6);
		}
		.header {
			display: flex;
			align-items: center;
			gap: 20px;
			border-bottom: 2px solid #202026;
			padding-bottom: 25px;
			margin-bottom: 30px;
		}
		.logo {
			width: 60px;
			height: 69px;
		}
		.title-area h1 {
			margin: 0;
			font-size: 28px;
			font-weight: 700;
			letter-spacing: 1px;
			color: #c8b4f0;
			text-shadow: 0 0 15px rgba(200, 180, 240, 0.4);
		}
		.title-area p {
			margin: 5px 0 0 0;
			color: #8f8f9e;
			font-size: 14px;
		}
		.stats-grid {
			display: grid;
			grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
			gap: 15px;
			margin-bottom: 30px;
		}
		.stat-card {
			background: #181820;
			border: 1px solid #262632;
			border-radius: 8px;
			padding: 15px;
			text-align: center;
		}
		.stat-val {
			font-size: 24px;
			font-weight: 700;
			color: #e0d8f0;
			margin-bottom: 5px;
		}
		.stat-label {
			font-size: 12px;
			color: #8f8f9e;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		table {
			width: 100%;
			border-collapse: collapse;
			margin-top: 20px;
		}
		th, td {
			padding: 12px 15px;
			text-align: left;
			border-bottom: 1px solid #202026;
		}
		th {
			background-color: #16161e;
			color: #c8b4f0;
			font-size: 13px;
			text-transform: uppercase;
			letter-spacing: 0.5px;
		}
		td {
			font-size: 14px;
		}
		tr:hover {
			background-color: #16161e;
		}
		.badge {
			display: inline-block;
			padding: 3px 8px;
			border-radius: 12px;
			font-size: 11px;
			font-weight: 600;
			text-transform: uppercase;
		}
		.badge-danger { background-color: rgba(235, 87, 87, 0.15); color: #eb5757; border: 1px solid rgba(235, 87, 87, 0.3); }
		.badge-warning { background-color: rgba(242, 201, 76, 0.15); color: #f2c94c; border: 1px solid rgba(242, 201, 76, 0.3); }
		.badge-info { background-color: rgba(169, 141, 232, 0.15); color: #a98de8; border: 1px solid rgba(169, 141, 232, 0.3); }
		.agent-name {
			color: #82cfff;
			font-family: monospace;
			font-weight: 600;
		}
		.outcome-success { color: #27ae60; font-weight: 600; }
		.outcome-blocked { color: #f2c94c; font-weight: 600; }
		.outcome-failed { color: #eb5757; font-weight: 600; }
	</style>
</head>
<body>
	<div class="container">
		<div class="header">
			<img class="logo" src="data:image/svg+xml;base64,${logoBase64}" alt="Kyvora Logo" />
			<div class="title-area">
				<h1>KYVORA SECURITY AUDIT REPORT</h1>
				<p>Session ID: ${sessionId} &bull; Generated: ${new Date().toLocaleString()}</p>
			</div>
		</div>

		<div class="stats-grid">
			<div class="stat-card">
				<div class="stat-val">${summary.totalActions}</div>
				<div class="stat-label">Total Actions</div>
			</div>
			<div class="stat-card">
				<div class="stat-val" style="color: #eb5757;">${summary.securityViolations}</div>
				<div class="stat-label">Security Violations</div>
			</div>
			<div class="stat-card">
				<div class="stat-val" style="color: #f2c94c;">${summary.blockedActions}</div>
				<div class="stat-label">Blocked Actions</div>
			</div>
			<div class="stat-card">
				<div class="stat-val">${summary.fileWrites}</div>
				<div class="stat-label">File Writes</div>
			</div>
			<div class="stat-card">
				<div class="stat-val">${summary.commandExecs}</div>
				<div class="stat-label">Command Executions</div>
			</div>
		</div>

		<h2>Audit Log Detail</h2>
		<table>
			<thead>
				<tr>
					<th>Time</th>
					<th>Agent</th>
					<th>Action</th>
					<th>Details</th>
					<th>Severity</th>
					<th>Outcome</th>
				</tr>
			</thead>
			<tbody>
				${tableRows || '<tr><td colspan="6" style="text-align: center; color: #8f8f9e;">No actions recorded for this session.</td></tr>'}
			</tbody>
		</table>
	</div>
</body>
</html>`;
	}

	private async persist(entry: AuditEntry): Promise<void> {
		try {
			const text = JSON.stringify(entry) + '\n';
			await this.fileService.writeFile(
				this.logFileUri,
				VSBuffer.fromString(text),
				{ unlock: true, append: true }
			);
		} catch (e) {
			console.error('Failed to persist audit entry:', e);
		}
	}
}
