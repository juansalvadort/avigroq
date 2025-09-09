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
