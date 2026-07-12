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
		eagleColor: '\x1b[38;5;248m', // Soft White/Gray
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

const EAGLE_ASCII = `                              ___,--------,____
                      __--~~~~                 ~~---,_
                   ,-'                  __,--,_       \`\\,___,-,__
                ,-'                 __/'/-~~~\\  \`  \` . '    , |  \`~~\\
             _/\`      _/~~      '~~   \\,_\\_ O /        '  '~_/'      \`\\
           /'        '                   =-'~~  _  /  ~   /'          \`\\
        _/'  /~                            ,--,____,-----|,_,-,_       \`\\
    _,/'    '              ,-'      _      \`~'------'~~~~~--    \`~~~~\\  |
 ,-'             /~       '    ,-~~~         _,       ,-=~~~~~~~~~~~~'| |
~              .'             '         ,   '      /~\`                |/
                                  /' ,/'       _/~\`
                   ,       /    /\`          _/~
        /~        /      /\`               /'
      .'                                /'
                       /'      .      /
                      \`       /'     |
                                    '`;

const LOGO_ASCII = `
 ██╗  ██╗██╗   ██╗██╗   ██╗ ██████╗ ██████╗  █████╗ 
 ██║ ██╔╝╚██╗ ██╔╝██║   ██║██╔═══██╗██╔══██╗██╔══██╗
 █████╔╝  ╚████╔╝ ██║   ██║██║   ██║██████╔╝███████║
 ██╔═██╗   ╚██╔╝  ╚██╗ ██╔╝██║   ██║██╔══██╗██╔══██║
 ██║  ██╗   ██║    ╚████╔╝ ╚██████╔╝██║  ██║██║  ██║
 ╚═╝  ╚═╝   ╚═╝     ╚═══╝   ╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝`;

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

	// Left align Eagle as a block
	lines.push(...leftAlignBlock(EAGLE_ASCII, ec, rst, 4));
	lines.push('');

	// Left align KYVORA Logo as a block
	lines.push(...leftAlignBlock(LOGO_ASCII, lc, rst, 4));
	lines.push('');

	return lines.join('\r\n');
}

function leftAlignBlock(art: string, colorPrefix: string, colorSuffix: string, leftMargin: number = 4): string[] {
	const lines = art.split('\n');
	const padding = ' '.repeat(leftMargin);
	return lines.map(line => {
		if (!line.trim()) {
			return '';
		}
		return padding + colorPrefix + line + colorSuffix;
	});
}
