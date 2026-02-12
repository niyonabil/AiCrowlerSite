import { ApiKeys, AIAgent } from '../types';

export const AI_PROVIDERS = {
  gemini: { label: 'Google Gemini', apiKeyField: 'gemini' },
  openai: { label: 'OpenAI', apiKeyField: 'openAI', endpoint: 'https://api.openai.com/v1/chat/completions' },
  openrouter: { label: 'OpenRouter', apiKeyField: 'openRouter', endpoint: 'https://openrouter.ai/api/v1/chat/completions', needsReferer: true },
  mistral: { label: 'Mistral', apiKeyField: 'mistral', endpoint: 'https://api.mistral.ai/v1/chat/completions' },
  groq: { label: 'Groq', apiKeyField: 'groq', endpoint: 'https://api.groq.com/openai/v1/chat/completions' },
  together: { label: 'Together AI', apiKeyField: 'together', endpoint: 'https://api.together.xyz/v1/chat/completions' },
  fireworks: { label: 'Fireworks AI', apiKeyField: 'fireworks', endpoint: 'https://api.fireworks.ai/inference/v1/chat/completions' },
  deepseek: { label: 'DeepSeek', apiKeyField: 'deepseek', endpoint: 'https://api.deepseek.com/chat/completions' },
  xai: { label: 'xAI (Grok)', apiKeyField: 'xai', endpoint: 'https://api.x.ai/v1/chat/completions' },
  perplexity: { label: 'Perplexity', apiKeyField: 'perplexity', endpoint: 'https://api.perplexity.ai/chat/completions' },
  ollama_cloud: { label: 'Ollama Cloud API', apiKeyField: 'ollamaCloud', endpoint: 'https://api.ollama.com/v1/chat/completions' },
} as const;

export type AIProvider = keyof typeof AI_PROVIDERS;

export const providerOptions = Object.entries(AI_PROVIDERS).map(([value, config]) => ({
  value: value as AIProvider,
  label: config.label,
}));

export const getApiKeyFromStore = (keys: ApiKeys | undefined, provider: AIAgent['provider']): string => {
  if (!keys) return '';
  const field = AI_PROVIDERS[provider]?.apiKeyField;
  if (!field) return '';
  return keys[field] || '';
};

export const getChatCompletionEndpoint = (provider: Exclude<AIProvider, 'gemini'>): string => AI_PROVIDERS[provider].endpoint!;
