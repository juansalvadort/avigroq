export const DEFAULT_CHAT_MODEL: string = 'chat-model';

export interface ChatModel {
  id: string;
  name: string;
  description: string;
}

export const chatModels: Array<ChatModel> = [
  {
    id: 'chat-model',
    name: 'GPT-4o mini',
    description: 'Modelo multimodal rápido y económico (texto/imagen)',
  },
  {
    id: 'chat-model-reasoning',
    name: 'o4-mini (Reasoning)',
    description: 'Razonamiento estructurado para tareas complejas',
  },
];
