import { DisposableStore } from '../../../../base/common/lifecycle.js';
import { Range } from '../../../../editor/common/core/range.js';
import { CodeAction, CodeActionList, InlineCompletionContext, InlineCompletions, InlineCompletion } from '../../../../editor/common/languages.js';
import { ITextModel } from '../../../../editor/common/model.js';
import { Position } from '../../../../editor/common/core/position.js';
import { CancellationToken } from '../../../../base/common/cancellation.js';
import { ILanguageFeaturesService } from '../../../../editor/common/services/languageFeatures.js';
import { CodeActionKind } from '../../../../editor/contrib/codeAction/common/types.js';
import { IInstantiationService } from '../../../../platform/instantiation/common/instantiation.js';
import { IWorkbenchContribution } from '../../../common/contributions.js';
import { IKyvoraAgentService } from '../common/kyvoraAgentService.js';
import { CommandsRegistry } from '../../../../platform/commands/common/commands.js';
import { IViewsService } from '../../../services/views/common/viewsService.js';
import { KyvoraAgentHubView } from './kyvoraAgentHubView.js';
import { IMarkerService, MarkerSeverity } from '../../../../platform/markers/common/markers.js';

export class KyvoraFeatures implements IWorkbenchContribution {
	private readonly _store = new DisposableStore();

	constructor(
		@ILanguageFeaturesService languageFeaturesService: ILanguageFeaturesService,
		@IKyvoraAgentService private readonly agentService: IKyvoraAgentService,
		@IInstantiationService instantiationService: IInstantiationService,
		@IViewsService private readonly viewsService: IViewsService,
		@IMarkerService private readonly markerService: IMarkerService
	) {
		// Register Inline Suggestions Provider
		this._store.add(languageFeaturesService.inlineCompletionsProvider.register('*', {
			provideInlineCompletions: async (model: ITextModel, position: Position, context: InlineCompletionContext, token: CancellationToken): Promise<InlineCompletions | undefined> => {
				if (!this.agentService.getFeatureState('inlineSuggestions')) {
					return undefined;
				}

				// Debounce to save API calls
				await new Promise(resolve => setTimeout(resolve, 350));
				if (token.isCancellationRequested) {
					return undefined;
				}

				// Get surrounding code context
				const lineCount = model.getLineCount();
				const prefixRange = new Range(
					Math.max(1, position.lineNumber - 50), 1,
					position.lineNumber, position.column
				);
				const suffixRange = new Range(
					position.lineNumber, position.column,
					Math.min(lineCount, position.lineNumber + 30), model.getLineMaxColumn(Math.min(lineCount, position.lineNumber + 30))
				);

				const prefix = model.getValueInRange(prefixRange);
				const suffix = model.getValueInRange(suffixRange);

				const prompt = `You are Kyvora Inline AI. Predict the next code suggestion for the current position in the file.
File path: ${model.uri.path}
Language: ${model.getLanguageId()}
Code before cursor:
${prefix}
[CURSOR_HERE]
Code after cursor:
${suffix}

Provide only the predicted completion text that should be inserted directly at [CURSOR_HERE].
Do NOT wrap in markdown block, do NOT explain, and do NOT repeat existing characters.`;

				try {
					const pm = this.agentService.getProviderManager();
					const result = await pm.callAI(prompt, 'completion');
					if (token.isCancellationRequested) return undefined;

					// Clean clean response (remove codeblocks if LLM failed to follow instruction)
					let cleanResult = result.trim();
					if (cleanResult.startsWith('```')) {
						cleanResult = cleanResult.replace(/^```[a-zA-Z]*\n/, '').replace(/\n```$/, '');
					}

					if (!cleanResult) return undefined;

					const suggestion: InlineCompletion = {
						insertText: cleanResult,
						range: new Range(position.lineNumber, position.column, position.lineNumber, position.column)
					};

					return {
						items: [suggestion]
					};
				} catch (e) {
					console.error('Failed to get inline suggestions:', e);
					return undefined;
				}
			},
			handleItemDidShow: () => {},
			disposeInlineCompletions: () => {}
		}));

		// Register Code Action Provider for Quick Fixes ("✨ Fix with AI")
		this._store.add(languageFeaturesService.codeActionProvider.register('*', {
			provideCodeActions: async (model: ITextModel, range: Range, context, token: CancellationToken): Promise<CodeActionList | undefined> => {
				if (!this.agentService.getFeatureState('errorDetection') || !this.agentService.getFeatureState('autoFix')) {
					return undefined;
				}

				const markers = this.markerService.read({ resource: model.uri });
				const errorMarkers = markers.filter(m => m.severity === MarkerSeverity.Error && Range.areIntersectingOrTouching(range, m));
				if (errorMarkers.length === 0) {
					return undefined;
				}

				const actions: CodeAction[] = [];
				for (const marker of errorMarkers) {
					actions.push({
						title: `✨ Fix with AI: "${marker.message.substring(0, 45)}..."`,
						kind: CodeActionKind.QuickFix.value,
						command: {
							id: 'kyvora.fixWithAI',
							title: 'Fix with AI',
							arguments: [model.uri.toString(), marker]
						}
					});
				}

				return {
					actions,
					dispose: () => {}
				};
			}
		}));

		// Register the Command in registry
		CommandsRegistry.registerCommand('kyvora.fixWithAI', (accessor, fileUri: string, marker: any) => {
			const view = this.viewsService.getViewWithId<KyvoraAgentHubView>('kyvora.agentsOverview');
			if (view) {
				view.showFixWithAI(fileUri, marker);
			}
		});
	}

	dispose(): void {
		this._store.dispose();
	}
}
