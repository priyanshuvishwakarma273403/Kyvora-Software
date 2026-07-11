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
                               /T /I
                              / |/ | .-~/
                          T\\ Y  I  |/  /  _
         /T               | \\I  |  I  Y.-~/
        I l   /I       T\\ |  |  l  |  T  /
 __  | \\l   \\l  \\I l __l  l   \\   \\`  _. |
 \\ ~-l  \\`\\   \\`\\  \\  \\\\ ~\\  \\   \\`. .-~   |
  \\   ~-. "-.  \\`  \\  ^._ ^. "-.  /  \\   |
.--~-._  ~-  \\`  _  ~-_.-\"-.\" ._ /._ .\" ./
 >--.  ~-.   ._  ~>-\"    \"\\\\   7   7   ]
^.___~\"--._    ~-{  .-~ .  \\`\\ Y . /    |
 <__ ~\"-.  ~       /_/   \\   \\I  Y   : |
   ^-.__           ~(_/   \\   >._:   | l______
       ^--.,___.-~"  /_/   !  \\`-.~\"--l_ /     ~\"-.
              (_/ .  ~(   /'     \"~\"--,Y   -=b-. _)
               (_/ .  \\  :           / l      c\"~o \\
                \\ /    \\`.    .     .^   \\_.-~\"~--.  )
                 (_/ .   \\`  /     /       !       )/
                  / / _.   '.   .':      /        '
                  ~(_/ .   /    _  \\`  .-<_      -Row
                    /_/ . ' .-~" \\`.  / \\  \\          ,z=.
                    ~( /   '  :   | K   \"-.~-.______//
                      \"-,.    l   I/ \\_    __{--->._(==.
                       //(     \\  <    ~\"~"     //
                      /' /\\     \\  \\     ,v=.  ((
                    .^. / /\\     \"  }__ //===-  \\`
                   / / ' '  \"-.,__ {---(==-
                 .^ '       :  T  ~\"   ll
                / .  .  . : | :!        \\\\
               (_/  /   | | j-\"          ~^
                 ~-<_(_.^-~"
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
	const cols = options.cols || 80;

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
	const ec = theme.eagleColor;
	const lc = theme.logoColor;

	const lines: string[] = [];
	lines.push('');

	// Centered Eagle
	EAGLE_ASCII.split('\n').forEach(line => {
		if (line.trim()) {
			lines.push(centerLine(`${ec}${line}${rst}`, cols));
		} else {
			lines.push('');
		}
	});
	lines.push('');

	// Centered KYVORA Logo
	LOGO_ASCII.split('\n').forEach(line => {
		if (line.trim()) {
			lines.push(centerLine(`${lc}${line}${rst}`, cols));
		} else {
			lines.push('');
		}
	});
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
