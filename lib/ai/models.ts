import { resolveOpenAIModel, myProvider } from './providers';
import { isTestEnvironment } from '../constants';

export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'Grok Vision',
    description: 'Advanced multimodal model with vision and text capabilities',
  },
  {
    id: 'chat-model-reasoning',
    name: 'Grok Reasoning',
    description: 'Uses advanced chain-of-thought reasoning for complex problems',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'OpenAI’s lightweight GPT-4o model for fast multimodal responses',
  },
  {
    id: 'o4-mini',
    name: 'O4 mini',
    description:
      'OpenAI reasoning model optimized for step-by-step problem solving',
  },
];

// [MODEL_RESOLVER]
export function resolveModel(selected: string) {
  const openaiIds = new Set(['gpt-5', 'gpt-5-mini', 'o4-mini', 'gpt-4o-mini']);
  if (selected.startsWith('openai/') || openaiIds.has(selected)) {
    if (isTestEnvironment) {
      return myProvider.languageModel(selected.replace(/^openai\//, ''));
    }
    return resolveOpenAIModel(selected.replace(/^openai\//, ''));
  }
  return myProvider.languageModel(selected);
}
