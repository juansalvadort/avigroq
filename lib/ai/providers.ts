import { customProvider } from 'ai';
import { gateway as gw } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';
import {
  artifactModel,
  chatModel,
  reasoningModel,
  titleModel,
} from './models.test';

export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export const myProvider = isTestEnvironment
  ? customProvider({
      languageModels: {
        'openai/gpt-4o-mini': chatModel,
        'gpt-4o-mini': chatModel,
        'openai/o4-mini': reasoningModel,
        'o4-mini': reasoningModel,
        'title-model': titleModel,
        'artifact-model': artifactModel,
      },
    })
  : {
      languageModel(id: string) {
        if (id === 'title-model') {
          return openaiProvider.responses('gpt-4o-mini');
        }
        if (id === 'artifact-model') {
          return openaiProvider.responses('gpt-4.1-mini');
        }
        return id.includes('/') ? gw(id) : openaiProvider.responses(id);
      },
    };

export { gw };
