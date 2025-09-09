import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';
import { isTestEnvironment } from '../constants';

// [OPENAI_PROVIDER_START]
export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.OPENAI_BASE_URL,
  organization: process.env.OPENAI_ORG,
  project: process.env.OPENAI_PROJECT,
});

export function resolveOpenAIModel(id: string) {
  switch (id) {
    case 'gpt-5':
      return openaiProvider('gpt-5');
    case 'gpt-5-mini':
      return openaiProvider('gpt-5-mini');
    case 'o4-mini':
      return wrapLanguageModel({
        model: openaiProvider('o4-mini'),
        middleware: extractReasoningMiddleware({ tagName: 'reasoning' }),
      });
    case 'gpt-4o-mini':
      return openaiProvider('gpt-4o-mini');
    default:
      return openaiProvider(id);
  }
}
// [OPENAI_PROVIDER_END]

const gatewayProvider = gateway({ apiKey: process.env.AI_GATEWAY_API_KEY });

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': chatModel,
        'chat-model-reasoning': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
        'gpt-4o-mini': chatModel,
        'o4-mini': reasoningModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': gatewayProvider.languageModel('xai/grok-2-vision-1212'),
        'chat-model-reasoning': wrapLanguageModel({
          model: gatewayProvider.languageModel('xai/grok-3-mini-beta'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'title-model': gatewayProvider.languageModel('xai/grok-2-1212'),
        'artifact-model': gatewayProvider.languageModel('xai/grok-2-1212'),
      },
    });
