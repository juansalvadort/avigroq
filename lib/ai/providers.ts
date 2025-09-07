import { customProvider } from 'ai';
import { gateway as gw } from '@ai-sdk/gateway';
import { createOpenAI } from '@ai-sdk/openai';
import { isTestEnvironment } from '../constants';

export const openaiProvider = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

let myProvider: any;

if (isTestEnvironment) {
  const dynamicImport = new Function('path', 'return import(path)');
  const {
    artifactModel,
    chatModel,
    reasoningModel,
    titleModel,
  } = await dynamicImport('./models.test');

  myProvider = customProvider({
    languageModels: {
      'openai/gpt-4o-mini': chatModel,
      'gpt-4o-mini': chatModel,
      'openai/o4-mini': reasoningModel,
      'o4-mini': reasoningModel,
      'title-model': titleModel,
      'artifact-model': artifactModel,
    },
  });
} else {
  myProvider = {
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
}

export { myProvider, gw };
