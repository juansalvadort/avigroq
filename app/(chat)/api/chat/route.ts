import {
  convertToModelMessages,
  createUIMessageStream,
  JsonToSseTransformStream,
  smoothStream,
  stepCountIs,
  streamText,
} from 'ai';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  createStreamId,
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages, generateUUID } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { createDocument } from '@/lib/ai/tools/create-document';
import { updateDocument } from '@/lib/ai/tools/update-document';
import { requestSuggestions } from '@/lib/ai/tools/request-suggestions';
import { getWeather } from '@/lib/ai/tools/get-weather';
import { isProductionEnvironment } from '@/lib/constants';
import { gw, openaiProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import {
  createResumableStreamContext,
  type ResumableStreamContext,
} from 'resumable-stream';
import { after } from 'next/server';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { VisibilityType } from '@/components/visibility-selector';

export const runtime = 'nodejs';

export const maxDuration = 60;

const DEFAULT_VECTOR_STORE_IDS = (process.env.OPENAI_VECTOR_STORE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

let globalStreamContext: ResumableStreamContext | null = null;

export function getStreamContext() {
  if (!globalStreamContext) {
    try {
      globalStreamContext = createResumableStreamContext({
        waitUntil: after,
      });
    } catch (error: any) {
      if (error.message.includes('REDIS_URL')) {
        console.log(
          ' > Resumable streams are disabled due to missing REDIS_URL',
        );
      } else {
        console.error(error);
      }
    }
  }

  return globalStreamContext;
}

export async function POST(request: Request) {
  let requestBody: PostRequestBody;

  try {
    const json = await request.json();
    requestBody = postRequestBodySchema.parse(json);
  } catch (_) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  try {
    const {
      id,
      message,
      selectedModelId,
      apiType,
      selectedVisibilityType,
      previousResponseId,
      vectorStoreIds,
      fileFilters,
      instructions,
      toolChoice,
    }: {
      id: string;
      message: ChatMessage;
      selectedModelId: string;
      apiType: 'gateway-chat' | 'openai-responses';
      selectedVisibilityType: VisibilityType;
      previousResponseId?: string;
      vectorStoreIds?: string[];
      fileFilters?: any;
      instructions?: string;
      toolChoice?: any;
    } = requestBody;

    const session = await auth();

    if (!session?.user) {
      return new ChatSDKError('unauthorized:chat').toResponse();
    }

    const userType: UserType = session.user.type;

    const messageCount = await getMessageCountByUserId({
      id: session.user.id,
      differenceInHours: 24,
    });

    if (messageCount > entitlementsByUserType[userType].maxMessagesPerDay) {
      return new ChatSDKError('rate_limit:chat').toResponse();
    }

    const chat = await getChatById({ id });

    if (!chat) {
      const title = await generateTitleFromUserMessage({
        message,
      });

      await saveChat({
        id,
        userId: session.user.id,
        title,
        visibility: selectedVisibilityType,
      });
    } else {
      if (chat.userId !== session.user.id) {
        return new ChatSDKError('forbidden:chat').toResponse();
      }
    }

    const messagesFromDb = await getMessagesByChatId({ id });
    const uiMessages = [...convertToUIMessages(messagesFromDb), message];

    const { longitude, latitude, city, country } = geolocation(request);

    const requestHints: RequestHints = {
      longitude,
      latitude,
      city,
      country,
    };

    await saveMessages({
      messages: [
        {
          chatId: id,
          id: message.id,
          role: 'user',
          parts: message.parts,
          attachments: [],
          createdAt: new Date(),
        },
      ],
    });

    const streamId = generateUUID();
    await createStreamId({ streamId, chatId: id });

    const vectorStoreIdsResolved = vectorStoreIds ?? DEFAULT_VECTOR_STORE_IDS;
    const filters = fileFilters;
    let responseId: string | undefined;

    const stream = createUIMessageStream({
      execute: ({ writer: dataStream }) => {
        const base = {
          system: systemPrompt({ selectedModelId, requestHints }),
          messages: convertToModelMessages(uiMessages),
          stopWhen: stepCountIs(5),
          experimental_transform: smoothStream({ chunking: 'word' }),
          experimental_telemetry: {
            isEnabled: isProductionEnvironment,
            functionId: 'stream-text',
          },
        } as const;

        const commonTools = {
          getWeather,
          createDocument: createDocument({ session, dataStream }),
          updateDocument: updateDocument({ session, dataStream }),
          requestSuggestions: requestSuggestions({ session, dataStream }),
        } as const;

        const responsesTools = {
          web_search_preview: openaiProvider.tools.webSearchPreview({}),
          file_search: openaiProvider.tools.fileSearch({
            vectorStoreIds: vectorStoreIdsResolved,
            ...(filters && { filters }),
          }),
        } as const;

        const tools = { ...commonTools, ...responsesTools } as const;

        const result =
          apiType === 'gateway-chat'
            ? streamText({
                ...base,
                model: gw(selectedModelId),
                experimental_activeTools: selectedModelId.includes('o4')
                  ? []
                  : ['getWeather', 'createDocument', 'updateDocument', 'requestSuggestions'],
                tools: commonTools,
                toolChoice: toolChoice ?? 'auto',
              })
            : streamText({
                ...base,
                model: openaiProvider.responses(selectedModelId),
                tools,
                toolChoice: toolChoice ?? 'auto',
                providerOptions: {
                  openai: {
                    ...(instructions && { instructions }),
                    ...(previousResponseId && { previousResponseId }),
                    include: ['file_search_call.results'],
                    reasoning: { effort: 'high' },
                  },
                },
              });

        result.consumeStream().then(() => {
          responseId =
            (result as any).response?.providerMetadata?.openai?.responseId as
              | string
              | undefined;
        });

        dataStream.merge(
          result.toUIMessageStream({
            sendReasoning: true,
          }),
        );
      },
      generateId: generateUUID,
      onFinish: async ({ messages }) => {
        if (responseId) {
          const last = messages[messages.length - 1];
          if (last && (last as any).role === 'assistant') {
            ((last as any).attachments as any[] | undefined)?.push?.({
              responseId,
            });
            if (!(last as any).attachments) {
              (last as any).attachments = [{ responseId }] as any;
            }
          }
        }

        await saveMessages({
          messages: messages.map((message) => ({
            id: message.id,
            role: message.role,
            parts: message.parts,
            createdAt: new Date(),
            attachments: (message as any).attachments ?? [],
            chatId: id,
          })),
        });
      },
      onError: () => {
        return 'Oops, an error occurred!';
      },
    });

    const streamContext = getStreamContext();

    if (streamContext) {
      return new Response(
        await streamContext.resumableStream(streamId, () =>
          stream.pipeThrough(new JsonToSseTransformStream()),
        ),
      );
    } else {
      return new Response(stream.pipeThrough(new JsonToSseTransformStream()));
    }
  } catch (error) {
    if (error instanceof ChatSDKError) {
      return error.toResponse();
    }

    console.error('Unhandled error in chat API:', error);
    return new ChatSDKError('offline:chat').toResponse();
  }
}

export async function DELETE(request: Request) {
  const { searchParams } = new URL(request.url);
  const id = searchParams.get('id');

  if (!id) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  const chat = await getChatById({ id });

  if (chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const deletedChat = await deleteChatById({ id });

  return Response.json(deletedChat, { status: 200 });
}
