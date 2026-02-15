/**
 * Unified AI Client — routes LLM calls through OpenRouter or directly to Anthropic.
 *
 * OpenRouter gives access to all major models (Claude, GPT-4o, Gemini, Llama, DeepSeek, etc.)
 * through a single API key and a unified OpenAI-compatible interface.
 *
 * Model registry:
 *   Each ETL task declares which model it needs by "task role":
 *     - 'semantic-match'   → high-quality Dutch political analysis (default: Claude Sonnet)
 *     - 'extract'          → promise extraction from programs (default: Claude Sonnet)
 *     - 'extract-light'    → fast pre-screening / chunk processing (default: Claude Haiku)
 *
 *   You can override any model via environment variables:
 *     AI_MODEL_SEMANTIC=anthropic/claude-sonnet-4-20250514
 *     AI_MODEL_EXTRACT=google/gemini-2.5-pro
 *     AI_MODEL_EXTRACT_LIGHT=anthropic/claude-3.5-haiku
 *
 *   Or override ALL tasks to use one model:
 *     AI_MODEL=anthropic/claude-sonnet-4-20250514
 *
 * Provider selection:
 *   If OPENROUTER_API_KEY is set → uses OpenRouter (https://openrouter.ai/api/v1)
 *   Otherwise falls back to ANTHROPIC_API_KEY → direct Anthropic API
 *
 * Usage:
 *   import { createAIClient, getModel } from '../lib/ai-client.js';
 *
 *   const ai = createAIClient();
 *   const text = await ai.chat(getModel('semantic-match'), prompt, { maxTokens: 4096 });
 */

// ─── Model Registry ─────────────────────────────────────────────

export type TaskRole = 'semantic-match' | 'extract' | 'extract-light';

/**
 * Default model for each task role.
 * Uses OpenRouter model identifiers (provider/model format).
 * When using direct Anthropic, the provider prefix is stripped automatically.
 */
const DEFAULT_MODELS: Record<TaskRole, string> = {
  'semantic-match': 'anthropic/claude-sonnet-4-20250514',
  'extract':        'anthropic/claude-sonnet-4-20250514',
  'extract-light':  'anthropic/claude-3-5-haiku-20241022',
};

/**
 * Resolve the model identifier for a given task role.
 * Priority: AI_MODEL_<ROLE> env → AI_MODEL env → default
 */
export function getModel(role: TaskRole): string {
  const envKey = `AI_MODEL_${role.toUpperCase().replace(/-/g, '_')}`;
  return process.env[envKey] || process.env.AI_MODEL || DEFAULT_MODELS[role];
}

/** Get a human-readable short name for logging */
export function modelShortName(model: string): string {
  // "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4"
  const name = model.includes('/') ? model.split('/')[1] : model;
  // Trim date suffix if present
  return name.replace(/-\d{8}$/, '');
}

// ─── Provider Detection ─────────────────────────────────────────

export type Provider = 'openrouter' | 'anthropic';

interface ProviderConfig {
  provider: Provider;
  apiKey: string;
  baseUrl: string;
}

function detectProvider(): ProviderConfig {
  const openrouterKey = process.env.OPENROUTER_API_KEY;
  if (openrouterKey) {
    return {
      provider: 'openrouter',
      apiKey: openrouterKey,
      baseUrl: 'https://openrouter.ai/api/v1',
    };
  }

  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    return {
      provider: 'anthropic',
      apiKey: anthropicKey,
      baseUrl: 'https://api.anthropic.com/v1',
    };
  }

  throw new Error(
    'No AI API key found. Set OPENROUTER_API_KEY (recommended) or ANTHROPIC_API_KEY.'
  );
}

// ─── Unified Chat Interface ─────────────────────────────────────

export interface ChatOptions {
  maxTokens?: number;
  temperature?: number;
  /** Optional system prompt */
  system?: string;
}

export interface ChatResponse {
  text: string;
  model: string;
  provider: Provider;
  usage?: {
    inputTokens: number;
    outputTokens: number;
  };
}

export interface AIClient {
  /** Send a single user message and get a text response */
  chat(model: string, prompt: string, options?: ChatOptions): Promise<ChatResponse>;
  /** Provider info for logging */
  provider: Provider;
  /** Base URL for logging */
  baseUrl: string;
}

// ─── OpenRouter Client (OpenAI-compatible) ──────────────────────

function createOpenRouterClient(config: ProviderConfig): AIClient {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,

    async chat(model: string, prompt: string, options: ChatOptions = {}): Promise<ChatResponse> {
      const { maxTokens = 4096, temperature, system } = options;

      const messages: Array<{ role: string; content: string }> = [];
      if (system) {
        messages.push({ role: 'system', content: system });
      }
      messages.push({ role: 'user', content: prompt });

      const response = await fetch(`${config.baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${config.apiKey}`,
          'HTTP-Referer': 'https://civicstat.nl',
          'X-Title': 'CivicStat ETL',
        },
        body: JSON.stringify({
          model,
          messages,
          max_tokens: maxTokens,
          ...(temperature !== undefined ? { temperature } : {}),
        }),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new AIError(response.status, `OpenRouter API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as any;
      const text = data.choices?.[0]?.message?.content;
      if (!text) {
        throw new Error('No text content in OpenRouter response');
      }

      return {
        text,
        model: data.model || model,
        provider: 'openrouter',
        usage: data.usage ? {
          inputTokens: data.usage.prompt_tokens || 0,
          outputTokens: data.usage.completion_tokens || 0,
        } : undefined,
      };
    },
  };
}

// ─── Direct Anthropic Client ────────────────────────────────────

function createAnthropicClient(config: ProviderConfig): AIClient {
  return {
    provider: config.provider,
    baseUrl: config.baseUrl,

    async chat(model: string, prompt: string, options: ChatOptions = {}): Promise<ChatResponse> {
      const { maxTokens = 4096, temperature, system } = options;

      // Strip provider prefix for direct Anthropic API
      // "anthropic/claude-sonnet-4-20250514" → "claude-sonnet-4-20250514"
      const anthropicModel = model.includes('/') ? model.split('/').pop()! : model;

      const body: any = {
        model: anthropicModel,
        max_tokens: maxTokens,
        messages: [{ role: 'user', content: prompt }],
      };
      if (system) body.system = system;
      if (temperature !== undefined) body.temperature = temperature;

      const response = await fetch(`${config.baseUrl}/messages`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': config.apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorBody = await response.text();
        throw new AIError(response.status, `Anthropic API error ${response.status}: ${errorBody}`);
      }

      const data = await response.json() as any;
      const text = data.content?.[0]?.text;
      if (!text) {
        throw new Error('No text content in Anthropic response');
      }

      return {
        text,
        model: data.model || anthropicModel,
        provider: 'anthropic',
        usage: data.usage ? {
          inputTokens: data.usage.input_tokens || 0,
          outputTokens: data.usage.output_tokens || 0,
        } : undefined,
      };
    },
  };
}

// ─── Error Class ────────────────────────────────────────────────

export class AIError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AIError';
  }

  get isRateLimit(): boolean {
    return this.status === 429;
  }

  get isOverloaded(): boolean {
    return this.status === 529 || this.status === 503;
  }

  get isServerError(): boolean {
    return this.status >= 500 && this.status < 600;
  }

  get isRetryable(): boolean {
    return this.isRateLimit || this.isOverloaded || this.isServerError;
  }
}

// ─── Factory ────────────────────────────────────────────────────

let _cached: AIClient | null = null;

/**
 * Create (or return cached) AI client.
 * Automatically detects provider from environment variables.
 */
export function createAIClient(): AIClient {
  if (_cached) return _cached;

  const config = detectProvider();

  if (config.provider === 'openrouter') {
    _cached = createOpenRouterClient(config);
  } else {
    _cached = createAnthropicClient(config);
  }

  return _cached;
}

/** Reset cached client (useful for testing) */
export function resetAIClient(): void {
  _cached = null;
}

// ─── Retry Helper ───────────────────────────────────────────────

export interface RetryOptions {
  maxRetries?: number;
  onRetry?: (attempt: number, delay: number, error: AIError) => void;
}

/**
 * Call AI with automatic retry on rate-limit / server errors.
 * Uses exponential backoff with longer delays for rate limits.
 */
export async function chatWithRetry(
  client: AIClient,
  model: string,
  prompt: string,
  chatOptions?: ChatOptions,
  retryOptions?: RetryOptions,
): Promise<ChatResponse> {
  const { maxRetries = 3, onRetry } = retryOptions || {};

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await client.chat(model, prompt, chatOptions);
    } catch (error: any) {
      const aiError = error instanceof AIError
        ? error
        : new AIError(error?.status || 0, error?.message || String(error));

      if (aiError.isRetryable && attempt < maxRetries) {
        const delay = aiError.isRateLimit
          ? Math.min(60000, 2000 * Math.pow(2, attempt)) // rate limit: 4s, 8s, 16s...
          : 2000 * Math.pow(2, attempt);                  // server error: 4s, 8s, 16s...

        if (onRetry) onRetry(attempt, delay, aiError);

        await new Promise((r) => setTimeout(r, delay));
        continue;
      }
      throw error;
    }
  }
  throw new Error('Unreachable');
}

// ─── Provider Info (for startup logging) ────────────────────────

export function getProviderInfo(): { provider: Provider; models: Record<TaskRole, string> } {
  const config = detectProvider();
  return {
    provider: config.provider,
    models: {
      'semantic-match': getModel('semantic-match'),
      'extract': getModel('extract'),
      'extract-light': getModel('extract-light'),
    },
  };
}
