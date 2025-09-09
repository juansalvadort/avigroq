export const DEFAULT_CHAT_MODEL: string = 'openai/gpt-4o-mini';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
  apiType: 'gateway-chat' | 'openai-responses';
  group: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'openai/gpt-4o-mini',
    name: 'GPT-4o mini (Gateway)',
    description: 'Modelo multimodal rápido vía Gateway',
    apiType: 'gateway-chat',
    group: 'Gateway',
  },
  {
    id: 'openai/o4-mini',
    name: 'o4-mini (Gateway Reasoning)',
    description: 'Razonamiento vía Gateway',
    apiType: 'gateway-chat',
    group: 'Gateway',
  },
  {
    id: 'gpt-4o-mini',
    name: 'GPT-4o mini',
    description: 'Modelo multimodal rápido y económico (texto/imagen)',
    apiType: 'openai-responses',
    group: 'Responses',
  },
  {
    id: 'o4-mini',
    name: 'o4-mini (Reasoning)',
    description: 'Razonamiento estructurado para tareas complejas',
    apiType: 'openai-responses',
    group: 'Responses',
  },
];
