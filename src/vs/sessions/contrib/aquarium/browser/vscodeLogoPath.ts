/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

// VS Code logo silhouette path, extracted from sessions/contrib/chat/browser/media/vscode-icon.svg.
// The aquarium cannot use that SVG file directly because each fish renders the
// logo as live, same-document SVG geometry: fish.ts stores this path in a
// shared <symbol>, then renders clipped <use> slices with staggered CSS
// animations. That keeps the swimming-strip effect, currentColor species
// tinting, and auxiliary-window support while avoiding duplicate path parsing
// per fish.
export const VSCODE_LOGO_PATH = 'M 19.5 16 L 28.5 16 L 28.5 84 L 19.5 84 Z M 23 46 L 65 14 L 71 22 L 29 54 Z M 29 46 L 71 78 L 65 86 L 23 54 Z M 61.5 16.5 L 68.5 23.5 L 83.5 38.5 L 83.5 57.5 L 68.5 72.5 L 61.5 79.5 L 68.5 79.5 L 83.5 64.5 L 83.5 31.5 L 68.5 16.5 Z M 30 50 C 30 38 48 38 56 50 C 64 62 82 62 82 50 C 82 38 64 38 56 50 C 48 62 30 62 30 50 Z M 33 50 C 33 59 45 59 56 50 C 67 41 79 41 79 50 C 79 59 67 59 56 50 C 45 41 33 41 33 50 Z';