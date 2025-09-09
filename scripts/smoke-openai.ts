import { openai } from '@ai-sdk/openai';
import { generateText } from 'ai';

async function main() {
  const { text, providerMetadata } = await generateText({
    model: openai('gpt-5'),
    prompt: 'Dime una frase de prueba y un emoji.',
    providerOptions: { openai: { textVerbosity: 'low', store: false } },
  });
  console.log('OK:', text);
  console.log('ResponseId:', providerMetadata?.openai?.responseId);
}

main().catch((e) => { console.error(e); process.exit(1); });
