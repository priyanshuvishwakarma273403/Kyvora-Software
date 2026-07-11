/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Kyvora Space. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import { IThemeService } from '../../../../platform/theme/common/themeService.js';
import { IConfigurationService } from '../../../../platform/configuration/common/configuration.js';

interface WelcomeTheme {
	id: string;
	name: string;
	eagleColor: string;
	logoColor: string;
	panelColor: string;
	accentColor: string;
	textColor: string;
}

const THEMES: Record<string, WelcomeTheme> = {
	default: {
		id: 'default',
		name: 'Kyvora Purple & Gold',
		eagleColor: '\x1b[38;5;220m', // Gold
		logoColor: '\x1b[38;5;99m',  // Violet/Purple
		panelColor: '\x1b[38;5;105m', // Lavender
		accentColor: '\x1b[38;5;208m', // Orange
		textColor: '\x1b[37m'          // White
	},
	cyberpunk: {
		id: 'cyberpunk',
		name: 'Cyberpunk Neon',
		eagleColor: '\x1b[38;5;201m', // Neon Pink/Magenta
		logoColor: '\x1b[38;5;51m',   // Neon Cyan
		panelColor: '\x1b[38;5;226m',  // Neon Yellow
		accentColor: '\x1b[38;5;81m',  // Light Blue
		textColor: '\x1b[97m'          // Bright White
	},
	matrix: {
		id: 'matrix',
		name: 'Digital Rain',
		eagleColor: '\x1b[32m',        // Dark Green
		logoColor: '\x1b[92m',         // Bright Green
		panelColor: '\x1b[32m',        // Dark Green
		accentColor: '\x1b[92m',       // Bright Green
		textColor: '\x1b[32m'          // Green
	},
	holiday: {
		id: 'holiday',
		name: 'Festive Holiday',
		eagleColor: '\x1b[38;5;196m', // Festive Red
		logoColor: '\x1b[38;5;34m',   // Forest Green
		panelColor: '\x1b[38;5;220m', // Gold
		accentColor: '\x1b[38;5;196m', // Red
		textColor: '\x1b[37m'          // White
	},
	monochrome: {
		id: 'monochrome',
		name: 'Minimal Gray',
		eagleColor: '\x1b[90m',        // Dark Gray
		logoColor: '\x1b[37m',         // Light Gray
		panelColor: '\x1b[90m',        // Dark Gray
		accentColor: '\x1b[97m',       // White
		textColor: '\x1b[37m'          // Light Gray
	}
};

const MOTD_LIST = [
	"The only way to do great work is to love what you do. -- Steve Jobs",
	"Design is not just what it looks like and feels like. Design is how it works. -- Steve Jobs",
	"Simplicity is the ultimate sophistication. -- Leonardo da Vinci",
	"Make it simple, but significant. -- Don Draper",
	"Empowering your development with autonomous AI Swarms.",
	"Synthesizing next-gen developer workflows in real-time.",
	"Zero latency, infinite context, autonomous engineering.",
	"Collaborate in real-time with AI multiplayer developer swarms.",
	"AST-guided next-edit completion active and ready."
];

const TIPS_LIST = [
	"Use Ctrl + Shift + P to open the command palette and boost your productivity with Kyvora.",
	"Set 'kyvora.ai.model' in settings to choose your favorite LLM (local or cloud).",
	"Use Alt + Right Click in the editor to trigger a deep AI refactoring loop.",
	"Open the 'Features' page in the navbar to explore comparison tables and FAQs.",
	"Check the 'Security Activity' view to verify sandbox access logs.",
	"Run 'kyvora.runAutonomousSandbox' in the console to auto-test and patch errors.",
	"Hover over items in the status bar to view current plugin diagnostics."
];

const EAGLE_ASCII = `
                                 .---.
                       _..---''     ''---.._
                 _.-''                       ''-._
             _.-'                                 '-._
           /                                           \\
          |            _  _             _  _            |
          |           ( \\/ )           ( \\/ )           |
           \\           \\  /             \\  /           /
            '.          \\/               \\/          .'
              '-._                               _.-'
                  '-._                       _.-'
                      '-._               _.-'
                          '--.._____..--'
                              /     \\
                             (o)   (o)
                              \\  V  /
                               \\___/
`;

const LOGO_ASCII = `
 ██╗  ██╗██╗   ██╗██╗   ██╗ ██████╗ ██████╗  █████╗ 
 ██║ ██╔╝╚██╗ ██╔╝██║   ██║██╔═══██╗██╔══██╗██╔══██╗
 █████╔╝  ╚████╔╝ ██║   ██║██║   ██║██████╔╝███████║
 ██╔═██╗   ╚██╔╝  ╚██╗ ██╔╝██║   ██║██╔══██╗██╔══██║
 ██║  ██╗   ██║    ╚████╔╝ ╚██████╔╝██║  ██║██║  ██║
 ╚═╝  ╚═╝   ╚═╝     ╚═══╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝
`;

export function getWelcomeScreenText(options: {
	workspaceName: string;
	gitBranch: string;
	currentTime: string;
	osName: string;
	nodeVer: string;
	javaVer: string;
	aiModel: string;
	isTrusted: boolean;
	themeService: IThemeService;
	configurationService: IConfigurationService;
	cols: number;
}): string {
	const workspaceName = options.workspaceName;
	const gitBranch = options.gitBranch;
	const currentTime = options.currentTime;
	const osName = options.osName;
	const nodeVer = options.nodeVer;
	const javaVer = options.javaVer;
	const aiModel = options.aiModel;
	const isTrusted = options.isTrusted ? 'Trusted' : 'Untrusted';
	const pluginCount = 128;
	const kyvoraVer = '1.0.0';

	// System details
	const cpuStr = 'Apple M2 Pro';
	const ramStr = '16.00 GB';
	const cpuUsageStr = '12%';
	const uptimeStr = '00:45:32';

	// Select Theme based on user setting
	const isLightTheme = options.themeService.getColorTheme().type === 'light';
	const selectedThemeId = options.configurationService.getValue<string>('kyvora.terminal.welcomeTheme') || 'default';
	let theme = THEMES[selectedThemeId] || THEMES.default;

	// Auto Seasonal overrides
	const currentMonth = new Date().getMonth();
	if (selectedThemeId === 'default') {
		if (currentMonth === 11) {
			theme = THEMES.holiday;
		} else if (currentMonth === 9) {
			theme = THEMES.cyberpunk;
		}
	}

	// Light Theme adjustments
	if (isLightTheme) {
		theme = {
			...theme,
			eagleColor: '\x1b[33m',
			logoColor: '\x1b[34m',
			panelColor: '\x1b[35m',
			accentColor: '\x1b[36m',
			textColor: '\x1b[30m'
		};
	}

	const rst = '\x1b[0m';
	const bld = '\x1b[1m';
	const ec = theme.eagleColor;
	const lc = theme.logoColor;
	const pc = theme.panelColor;
	const ac = theme.accentColor;
	const tc = theme.textColor;

	const cols = options.cols || 80;
	const isCompact = cols < 85;

	const lines: string[] = [];
	lines.push('');

	if (!isCompact) {
		// Centered Eagle
		EAGLE_ASCII.split('\n').forEach(line => {
			if (line.trim()) {
				lines.push(centerLine(`${ec}${line}${rst}`, cols));
			}
		});
		lines.push('');

		// Centered KYVORA Logo
		LOGO_ASCII.split('\n').forEach(line => {
			if (line.trim()) {
				lines.push(centerLine(`${lc}${line}${rst}`, cols));
			}
		});
		lines.push('');
	} else {
		lines.push(centerLine(`${bld}${lc}=== KYVORA AUTOMATED DEVELOPMENT ENVIRONMENT ===${rst}`, cols));
		lines.push('');
	}

	// Centered title helper
	lines.push(centerLine(`${ac}------ Welcome to Kyvora IDE ------${rst}`, cols));
	lines.push(centerLine(`${ac}AI-FIRST DEVELOPMENT ENVIRONMENT${rst}`, cols));
	lines.push('');

	// Build 3-column welcome panel (width 76)
	// Border length 76: '┌' + '─'*24 + '┬' + '─'*24 + '┬' + '─'*24 + '┐'
	const panelBorderCol = pc;
	const labelCol = tc;

	lines.push(centerLine(`${panelBorderCol}┌────────────────────────┬────────────────────────┬────────────────────────┐${rst}`, cols));

	// Row 1
	const col1_1 = padRight(`Workspace  : ${labelCol}${workspaceName}${rst}`, 22);
	const col1_2 = padRight(`Active Model: ${labelCol}${aiModel}${rst}`, 22);
	const col1_3 = padRight(`OS         : ${labelCol}${osName}${rst}`, 22);
	lines.push(centerLine(`${panelBorderCol}│${rst} ${col1_1} ${panelBorderCol}│${rst} ${col1_2} ${panelBorderCol}│${rst} ${col1_3} ${panelBorderCol}│${rst}`, cols));

	// Row 2
	const col2_1 = padRight(`Directory  : ${labelCol}${workspaceName}${rst}`, 22);
	const col2_2 = padRight(`Plugins    : ${labelCol}${pluginCount}${rst}`, 22);
	const col2_3 = padRight(`CPU        : ${labelCol}${cpuStr}${rst}`, 22);
	lines.push(centerLine(`${panelBorderCol}│${rst} ${col2_1} ${panelBorderCol}│${rst} ${col2_2} ${panelBorderCol}│${rst} ${col2_3} ${panelBorderCol}│${rst}`, cols));

	// Row 3
	const col3_1 = padRight(`Git Branch : ${labelCol}${gitBranch}${rst}`, 22);
	const col3_2 = padRight(`Shell      : ${labelCol}powershell${rst}`, 22);
	const col3_3 = padRight(`Memory     : ${labelCol}${ramStr}${rst}`, 22);
	lines.push(centerLine(`${panelBorderCol}│${rst} ${col3_1} ${panelBorderCol}│${rst} ${col3_2} ${panelBorderCol}│${rst} ${col3_3} ${panelBorderCol}│${rst}`, cols));

	// Row 4
	const col4_1 = padRight(`Git Status : ${labelCol}Clean${rst}`, 22);
	const col4_2 = padRight(`Node Ver   : ${labelCol}${nodeVer}${rst}`, 22);
	const col4_3 = padRight(`CPU Usage  : ${labelCol}${cpuUsageStr}${rst}`, 22);
	lines.push(centerLine(`${panelBorderCol}│${rst} ${col4_1} ${panelBorderCol}│${rst} ${col4_2} ${panelBorderCol}│${rst} ${col4_3} ${panelBorderCol}│${rst}`, cols));

	// Row 5
	const col5_1 = padRight(`Kyvora Ver : ${labelCol}${kyvoraVer}${rst}`, 22);
	const col5_2 = padRight(`Java Ver   : ${labelCol}${javaVer}${rst}`, 22);
	const col5_3 = padRight(`Uptime     : ${labelCol}${uptimeStr}${rst}`, 22);
	lines.push(centerLine(`${panelBorderCol}│${rst} ${col5_1} ${panelBorderCol}│${rst} ${col5_2} ${panelBorderCol}│${rst} ${col5_3} ${panelBorderCol}│${rst}`, cols));

	lines.push(centerLine(`${panelBorderCol}└────────────────────────┴────────────────────────┴────────────────────────┘${rst}`, cols));
	lines.push('');

	// Side-by-side MOTD & Tip boxes
	const randomMotd = MOTD_LIST[Math.floor(Math.random() * MOTD_LIST.length)];
	const randomTip = TIPS_LIST[Math.floor(Math.random() * TIPS_LIST.length)];

	const motdBoxLines = buildBox("MOTD", wrapText(randomMotd, 33), 37, pc, tc, rst);
	const tipBoxLines = buildBox("TIP OF THE DAY", wrapText(randomTip, 33), 37, pc, tc, rst);

	const boxGap = '  ';
	for (let i = 0; i < Math.max(motdBoxLines.length, tipBoxLines.length); i++) {
		const motdLine = motdBoxLines[i] || ' '.repeat(37);
		const tipLine = tipBoxLines[i] || ' '.repeat(37);
		lines.push(centerLine(motdLine + boxGap + tipLine, cols));
	}

	lines.push('');
	return lines.join('\r\n');
}

function centerLine(line: string, width: number): string {
	const cleanLine = line.replace(/\x1b\[[0-9;]*m/g, '');
	if (cleanLine.length >= width) {
		return line;
	}
	const padding = Math.floor((width - cleanLine.length) / 2);
	return ' '.repeat(padding) + line;
}

function padRight(text: string, length: number): string {
	const cleanText = text.replace(/\x1b\[[0-9;]*m/g, '');
	if (cleanText.length >= length) {
		return text;
	}
	return text + ' '.repeat(length - cleanText.length);
}

function wrapText(text: string, width: number): string[] {
	const words = text.split(' ');
	const lines: string[] = [];
	let currentLine = '';
	for (const word of words) {
		if ((currentLine + ' ' + word).trim().length <= width) {
			currentLine = (currentLine + ' ' + word).trim();
		} else {
			lines.push(currentLine);
			currentLine = word;
		}
	}
	if (currentLine) {
		lines.push(currentLine);
	}
	return lines;
}

function buildBox(title: string, contentLines: string[], width: number, borderCol: string, textCol: string, rst: string): string[] {
	const lines: string[] = [];
	const titlePart = `── ${title} `;
	const remaining = width - 2 - titlePart.length;
	lines.push(`${borderCol}┌${titlePart}${'─'.repeat(remaining)}┐${rst}`);

	// Pad all lines to match width
	const contentHeight = 3; // Fixed height for alignment
	for (let i = 0; i < contentHeight; i++) {
		const rawLine = contentLines[i] || '';
		const padded = padRight(rawLine, width - 4);
		lines.push(`${borderCol}│${rst} ${textCol}${padded}${rst} ${borderCol}│${rst}`);
	}

	lines.push(`${borderCol}└${'─'.repeat(width - 2)}┘${rst}`);
	return lines;
}
