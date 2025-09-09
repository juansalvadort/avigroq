import {
  customProvider,
  extractReasoningMiddleware,
  wrapLanguageModel,
} from 'ai';
import { gateway } from '@ai-sdk/gateway';
import { isTestEnvironment } from '../constants';

let testModels: typeof import('../../tests/models') | undefined;
if (isTestEnvironment) {
  testModels = await import('../../tests/models');
}

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'chat-model': testModels?.chatModel,
        'chat-model-reasoning': testModels?.reasoningModel,
        'gpt-4o-mini': testModels?.chatModel,
        'o4-mini': testModels?.reasoningModel,
        'title-model': testModels?.titleModel,
        'artifact-model': testModels?.artifactModel,
      },
    })
  : customProvider({
      languageModels: {
        'chat-model': gateway.languageModel('xai/grok-2-vision-1212'),
        'chat-model-reasoning': wrapLanguageModel({
          model: gateway.languageModel('xai/grok-3-mini-beta'),
          middleware: extractReasoningMiddleware({ tagName: 'think' }),
        }),
        'gpt-4o-mini': gateway.languageModel('openai/gpt-4o-mini'),
        'o4-mini': wrapLanguageModel({
          model: gateway.languageModel('openai/o4-mini'),
          middleware: extractReasoningMiddleware({ tagName: 'reasoning' }),
        }),
        'title-model': gateway.languageModel('xai/grok-2-1212'),
        'artifact-model': gateway.languageModel('xai/grok-2-1212'),
      },
    });
