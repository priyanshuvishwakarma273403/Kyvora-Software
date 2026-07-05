import { IStorageService, StorageScope, StorageTarget } from '../../../../platform/storage/common/storage.js';
import { IFileService } from '../../../../platform/files/common/files.js';
import { URI } from '../../../../base/common/uri.js';

const ENCRYPTION_KEY = 'kyvora-ide-pass-key-stable';

export interface UsageStats {
	requests: number;
	inputTokens: number;
	outputTokens: number;
	estimatedCost: number;
	averageResponseTime: number;
	lastResponseTime: number;
	rateLimitStatus: string;
}

export class ProviderManager {
	private currentProvider: string = 'gemini';
	private currentModel: string = 'Auto';
	private apiKeys: Map<string, string> = new Map();
	private stats: UsageStats = {
		requests: 0,
		inputTokens: 0,
		outputTokens: 0,
		estimatedCost: 0,
		averageResponseTime: 0,
		lastResponseTime: 0,
		rateLimitStatus: 'Good'
	};

	constructor(
		private readonly storageService: IStorageService,
		private readonly fileService: IFileService,
		private readonly workspaceRootUri: URI
	) {
		this.loadEnvKeys();
		this.loadStoredKeys();
		this.loadStats();

		const savedProvider = this.storageService.get('kyvora.ai.provider', StorageScope.WORKSPACE);
		if (savedProvider) this.currentProvider = savedProvider;

		const savedModel = this.storageService.get('kyvora.ai.model', StorageScope.WORKSPACE);
		if (savedModel) this.currentModel = savedModel;
	}

	private async loadEnvKeys(): Promise<void> {
		const envUris = [
			URI.joinPath(this.workspaceRootUri, '.env'),
			URI.joinPath(this.workspaceRootUri, 'vscode', '.env'),
		];
		for (const uri of envUris) {
			try {
				if (await this.fileService.exists(uri)) {
					const fileContent = await this.fileService.readFile(uri);
					const content = fileContent.value.toString();
					for (const line of content.split('\n')) {
						const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
						if (match) {
							const key = match[1];
							let value = match[2] || '';
							if (value.startsWith('"') && value.endsWith('"')) {
								value = value.substring(1, value.length - 1);
							} else if (value.startsWith("'") && value.endsWith("'")) {
								value = value.substring(1, value.length - 1);
							}
							value = value.trim();
							if (key === 'GEMINI_API_KEY') this.apiKeys.set('gemini', value);
							if (key === 'OPENROUTER_API_KEY') this.apiKeys.set('openrouter', value);
							if (key === 'GROQ_API_KEY') this.apiKeys.set('groq', value);
							if (key === 'HUGGINGFACE_API_KEY') this.apiKeys.set('huggingface', value);
							if (key === 'SAMBANOVA_API_KEY') this.apiKeys.set('sambanova', value);
						}
					}
				}
			} catch (e) {
				console.error('Error loading env file in ProviderManager:', e);
			}
		}
	}

	private loadStoredKeys(): void {
		const providers = ['gemini', 'openrouter', 'groq', 'huggingface', 'sambanova'];
		for (const p of providers) {
			const encrypted = this.storageService.get(`kyvora.ai.key.${p}`, StorageScope.APPLICATION);
			if (encrypted) {
				try {
					const decrypted = this.decrypt(encrypted);
					if (decrypted) {
						this.apiKeys.set(p, decrypted);
					}
				} catch (e) {
					console.error(`Failed to decrypt API key for ${p}:`, e);
				}
			}
		}
	}

	private loadStats(): void {
		const saved = this.storageService.get('kyvora.ai.stats', StorageScope.WORKSPACE);
		if (saved) {
			try {
				this.stats = JSON.parse(saved);
			} catch (e) {
				// use default
			}
		}
	}

	private saveStats(): void {
		this.storageService.store('kyvora.ai.stats', JSON.stringify(this.stats), StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	private rc4(key: string, str: string): string {
		const s: number[] = [];
		for (let i = 0; i < 256; i++) {
			s[i] = i;
		}
		let j = 0;
		for (let i = 0; i < 256; i++) {
			j = (j + s[i] + key.charCodeAt(i % key.length)) % 256;
			const temp = s[i];
			s[i] = s[j];
			s[j] = temp;
		}
		let i = 0;
		j = 0;
		let res = '';
		for (let y = 0; y < str.length; y++) {
			i = (i + 1) % 256;
			j = (j + s[i]) % 256;
			const temp = s[i];
			s[i] = s[j];
			s[j] = temp;
			const k = s[(s[i] + s[j]) % 256];
			res += String.fromCharCode(str.charCodeAt(y) ^ k);
		}
		return res;
	}

	private encrypt(text: string): string {
		const encrypted = this.rc4(ENCRYPTION_KEY, text);
		let hex = '';
		for (let i = 0; i < encrypted.length; i++) {
			hex += encrypted.charCodeAt(i).toString(16).padStart(2, '0');
		}
		return hex;
	}

	private decrypt(text: string): string {
		if (!text) {
			return '';
		}
		if (text.includes(':')) {
			const parts = text.split(':');
			text = parts[1] || parts[0];
		}
		try {
			let str = '';
			for (let i = 0; i < text.length; i += 2) {
				str += String.fromCharCode(parseInt(text.substring(i, i + 2), 16));
			}
			return this.rc4(ENCRYPTION_KEY, str);
		} catch (e) {
			return text;
		}
	}

	public setApiKey(provider: string, key: string): void {
		this.apiKeys.set(provider, key);
		const encrypted = this.encrypt(key);
		this.storageService.store(`kyvora.ai.key.${provider}`, encrypted, StorageScope.APPLICATION, StorageTarget.MACHINE);
	}

	public getApiKey(provider: string): string {
		return this.apiKeys.get(provider) || '';
	}

	public getAvailableProviders(): string[] {
		return Array.from(this.apiKeys.keys()).filter(p => !!this.apiKeys.get(p));
	}

	public getCurrentProvider(): string {
		return this.currentProvider;
	}

	public setCurrentProvider(provider: string): void {
		this.currentProvider = provider;
		this.storageService.store('kyvora.ai.provider', provider, StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	public getCurrentModel(): string {
		return this.currentModel;
	}

	public setCurrentModel(model: string): void {
		this.currentModel = model;
		this.storageService.store('kyvora.ai.model', model, StorageScope.WORKSPACE, StorageTarget.MACHINE);
	}

	public getUsageStats(): UsageStats {
		return this.stats;
	}

	public getModelDropdownList(): string[] {
		return ['Auto', 'Gemini 2.5 Flash', 'Gemini 2.5 Pro', 'DeepSeek', 'Qwen', 'Llama', 'Mistral', 'GPT OSS', 'Custom Model'];
	}

	public selectAutoModel(taskType: 'completion' | 'refactoring' | 'architecture' | 'generation'): { provider: string; model: string } {
		const available = this.getAvailableProviders();
		const provider = available.includes(this.currentProvider) ? this.currentProvider : (available[0] || 'gemini');

		let model = 'gemini-2.5-flash';
		if (provider === 'gemini') {
			model = (taskType === 'completion') ? 'gemini-2.5-flash' : 'gemini-2.5-pro';
		} else if (provider === 'openrouter') {
			if (taskType === 'completion') {
				model = 'google/gemini-2.5-flash';
			} else if (taskType === 'refactoring') {
				model = 'deepseek/deepseek-chat';
			} else {
				model = 'meta-llama/llama-3.3-70b-instruct';
			}
		} else if (provider === 'groq') {
			model = (taskType === 'completion') ? 'llama-3.1-8b-instant' : 'llama-3.3-70b-versatile';
		} else if (provider === 'sambanova') {
			model = 'Meta-Llama-3.1-405B-Instruct';
		} else if (provider === 'huggingface') {
			model = 'bigcode/starcoder2-15b';
		}

		return { provider, model };
	}

	public async callAI(prompt: string, taskType: 'completion' | 'refactoring' | 'architecture' | 'generation' = 'generation'): Promise<string> {
		const startTime = Date.now();
		let targetProvider = this.currentProvider;
		let targetModel = this.currentModel;

		if (targetModel === 'Auto') {
			const autoSelected = this.selectAutoModel(taskType);
			targetProvider = autoSelected.provider;
			targetModel = autoSelected.model;
		} else {
			// Map dropdown model option to provider-specific name
			targetModel = this.mapDropdownToModel(this.currentModel, targetProvider);
		}

		let apiKey = this.apiKeys.get(targetProvider) || '';
		if (!apiKey) {
			// Auto Mode: Failover if missing key
			const available = this.getAvailableProviders();
			if (available.length > 0) {
				targetProvider = available[0];
				apiKey = this.apiKeys.get(targetProvider)!;
				const autoSelected = this.selectAutoModel(taskType);
				targetModel = autoSelected.model;
				console.warn(`[ProviderManager] Missing API key for ${this.currentProvider}, automatically switched to ${targetProvider}`);
			} else {
				throw new Error('No AI provider API keys configured. Please add one in settings or .env file.');
			}
		}

		try {
			const result = await this.executeCall(targetProvider, targetModel, apiKey, prompt);
			const duration = Date.now() - startTime;

			// Update stats
			const inputTokens = Math.ceil(prompt.length / 3.5);
			const outputTokens = Math.ceil(result.length / 3.5);
			const cost = this.calculateCost(targetModel, inputTokens, outputTokens);

			this.stats.requests++;
			this.stats.inputTokens += inputTokens;
			this.stats.outputTokens += outputTokens;
			this.stats.estimatedCost += cost;
			this.stats.lastResponseTime = duration;
			this.stats.averageResponseTime = this.stats.averageResponseTime === 0
				? duration
				: Math.round((this.stats.averageResponseTime * 9 + duration) / 10);
			this.stats.rateLimitStatus = 'Good';
			this.saveStats();

			return result;
		} catch (error: any) {
			console.error(`[ProviderManager] API Call failed on ${targetProvider} (${targetModel}):`, error);
			// Failover switch: Try other providers
			const available = this.getAvailableProviders().filter(p => p !== targetProvider);
			if (available.length > 0) {
				const fallbackProvider = available[0];
				console.warn(`[ProviderManager] Retrying with fallback provider: ${fallbackProvider}`);
				const fallbackApiKey = this.apiKeys.get(fallbackProvider)!;
				const fallbackModel = this.mapDropdownToModel(this.currentModel === 'Auto' ? 'Auto' : this.currentModel, fallbackProvider);
				try {
					const result = await this.executeCall(fallbackProvider, fallbackModel, fallbackApiKey, prompt);
					const duration = Date.now() - startTime;

					const inputTokens = Math.ceil(prompt.length / 3.5);
					const outputTokens = Math.ceil(result.length / 3.5);
					const cost = this.calculateCost(fallbackModel, inputTokens, outputTokens);

					this.stats.requests++;
					this.stats.inputTokens += inputTokens;
					this.stats.outputTokens += outputTokens;
					this.stats.estimatedCost += cost;
					this.stats.lastResponseTime = duration;
					this.stats.averageResponseTime = this.stats.averageResponseTime === 0
						? duration
						: Math.round((this.stats.averageResponseTime * 9 + duration) / 10);
					this.stats.rateLimitStatus = 'Switched';
					this.saveStats();

					return result;
				} catch (fallbackError: any) {
					this.stats.rateLimitStatus = 'Rate Limit / Error';
					this.saveStats();
					throw fallbackError;
				}
			} else {
				this.stats.rateLimitStatus = 'Error';
				this.saveStats();
				throw error;
			}
		}
	}

	private mapDropdownToModel(dropdownVal: string, provider: string): string {
		if (dropdownVal === 'Auto') {
			return 'Auto';
		}
		const lowerVal = dropdownVal.toLowerCase();
		if (provider === 'gemini') {
			if (lowerVal.includes('flash')) return 'gemini-2.5-flash';
			if (lowerVal.includes('pro')) return 'gemini-2.5-pro';
			return 'gemini-2.5-flash';
		}
		if (provider === 'openrouter') {
			if (lowerVal.includes('flash')) return 'google/gemini-2.5-flash';
			if (lowerVal.includes('pro')) return 'google/gemini-2.5-pro';
			if (lowerVal.includes('deepseek')) return 'deepseek/deepseek-chat';
			if (lowerVal.includes('qwen')) return 'qwen/qwen-2.5-72b-instruct';
			if (lowerVal.includes('llama')) return 'meta-llama/llama-3.3-70b-instruct';
			if (lowerVal.includes('mistral')) return 'mistralai/mistral-large';
			return 'google/gemini-2.5-flash';
		}
		if (provider === 'groq') {
			if (lowerVal.includes('llama')) return 'llama-3.3-70b-versatile';
			if (lowerVal.includes('mistral') || lowerVal.includes('mixtral')) return 'mixtral-8x7b-32768';
			return 'llama-3.3-70b-versatile';
		}
		if (provider === 'sambanova') {
			if (lowerVal.includes('llama')) return 'Meta-Llama-3.1-405B-Instruct';
			if (lowerVal.includes('qwen')) return 'Qwen2.5-72B-Instruct';
			return 'Meta-Llama-3.1-70B-Instruct-Preview';
		}
		if (provider === 'huggingface') {
			if (lowerVal.includes('llama')) return 'meta-llama/Llama-3.3-70B-Instruct';
			return 'bigcode/starcoder2-15b';
		}
		return dropdownVal;
	}

	private calculateCost(model: string, inputTokens: number, outputTokens: number): number {
		const lower = model.toLowerCase();
		let inputRate = 0.0000005; // default: $0.50 per 1M tokens
		let outputRate = 0.0000015; // default: $1.50 per 1M tokens

		if (lower.includes('flash')) {
			inputRate = 0.000000075;
			outputRate = 0.0000003;
		} else if (lower.includes('pro')) {
			inputRate = 0.00000125;
			outputRate = 0.000005;
		} else if (lower.includes('llama') || lower.includes('groq')) {
			inputRate = 0.0000002;
			outputRate = 0.0000002;
		} else if (lower.includes('deepseek')) {
			inputRate = 0.00000014;
			outputRate = 0.00000028;
		}
		return (inputTokens * inputRate) + (outputTokens * outputRate);
	}

	private async executeCall(provider: string, model: string, apiKey: string, prompt: string): Promise<string> {
		if (provider === 'gemini') {
			const actualModel = model === 'Auto' ? 'gemini-2.5-flash' : model;
			const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${actualModel}:generateContent?key=${apiKey}`, {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					contents: [{ parts: [{ text: prompt }] }],
					generationConfig: { responseMimeType: 'application/json' }
				})
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`Gemini API Error (${response.status}): ${errText}`);
			}
			const data = await response.json() as any;
			return data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
		}

		if (provider === 'openrouter') {
			const actualModel = model === 'Auto' ? 'google/gemini-2.5-flash' : model;
			const response = await fetch(`https://openrouter.ai/api/v1/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`,
					'HTTP-Referer': 'https://kyvora.ai',
					'X-Title': 'Kyvora Studio'
				},
				body: JSON.stringify({
					model: actualModel,
					messages: [{ role: 'user', content: prompt }]
				})
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`OpenRouter Error (${response.status}): ${errText}`);
			}
			const data = await response.json() as any;
			return data.choices?.[0]?.message?.content || '{}';
		}

		if (provider === 'groq') {
			const actualModel = model === 'Auto' ? 'llama-3.3-70b-versatile' : model;
			const response = await fetch(`https://api.groq.com/openai/v1/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: actualModel,
					messages: [{ role: 'user', content: prompt }]
				})
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`Groq Error (${response.status}): ${errText}`);
			}
			const data = await response.json() as any;
			return data.choices?.[0]?.message?.content || '{}';
		}

		if (provider === 'sambanova') {
			const actualModel = model === 'Auto' ? 'Meta-Llama-3.1-70B-Instruct-Preview' : model;
			const response = await fetch(`https://api.sambanova.ai/v1/chat/completions`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: actualModel,
					messages: [{ role: 'user', content: prompt }]
				})
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`SambaNova Error (${response.status}): ${errText}`);
			}
			const data = await response.json() as any;
			return data.choices?.[0]?.message?.content || '{}';
		}

		if (provider === 'huggingface') {
			const actualModel = model === 'Auto' ? 'bigcode/starcoder2-15b' : model;
			const response = await fetch(`https://api-inference.huggingface.co/models/${actualModel}`, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					inputs: prompt
				})
			});
			if (!response.ok) {
				const errText = await response.text();
				throw new Error(`HuggingFace Error (${response.status}): ${errText}`);
			}
			const data = await response.json() as any;
			if (Array.isArray(data)) {
				return data[0]?.generated_text || JSON.stringify(data);
			}
			return data.generated_text || JSON.stringify(data);
		}

		throw new Error(`Unknown provider: ${provider}`);
	}
}
