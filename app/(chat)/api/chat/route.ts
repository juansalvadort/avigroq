import { convertToModelMessages, smoothStream, stepCountIs, streamText } from 'ai';
import crypto from 'node:crypto';
import { auth, type UserType } from '@/app/(auth)/auth';
import { type RequestHints, systemPrompt } from '@/lib/ai/prompts';
import {
  deleteChatById,
  getChatById,
  getMessageCountByUserId,
  getMessagesByChatId,
  saveChat as saveChatMetadata,
  saveMessages,
} from '@/lib/db/queries';
import { convertToUIMessages } from '@/lib/utils';
import { generateTitleFromUserMessage } from '../../actions';
import { isProductionEnvironment } from '@/lib/constants';
import { gw, openaiProvider } from '@/lib/ai/providers';
import { entitlementsByUserType } from '@/lib/ai/entitlements';
import { postRequestBodySchema, type PostRequestBody } from './schema';
import { geolocation } from '@vercel/functions';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import type { VisibilityType } from '@/components/visibility-selector';
import { upsertMessage } from '@/hooks/messages-reducer';

export const runtime = 'nodejs';

export const maxDuration = 60;

const DEFAULT_VECTOR_STORE_IDS = (process.env.OPENAI_VECTOR_STORE_IDS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

async function saveChat({
  id,
  messages,
}: {
  id: string;
  messages: ChatMessage[];
}) {
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

      await saveChatMetadata({
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
    const messages = upsertMessage(
      convertToUIMessages(messagesFromDb),
      message,
    );

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

    const vectorStoreIdsResolved = vectorStoreIds ?? DEFAULT_VECTOR_STORE_IDS;
    const filters = fileFilters;

    const base = {
      system: systemPrompt({ selectedModelId, requestHints }),
      messages: convertToModelMessages(messages),
      stopWhen: stepCountIs(5),
      experimental_transform: smoothStream({ chunking: 'word' }),
      experimental_telemetry: {
        isEnabled: isProductionEnvironment,
        functionId: 'stream-text',
      },
    } as const;

    const result =
      apiType === 'gateway-chat'
        ? streamText({
            ...base,
            model: gw(selectedModelId),
          })
        : streamText({
            ...base,
            model: openaiProvider.responses(selectedModelId),
            providerOptions: {
              openai: {
                ...(instructions && { instructions }),
                ...(previousResponseId && { previousResponseId }),
                include: ['file_search_call.results'],
                reasoning: { effort: 'high' },
                ...(filters && { filters }),
                ...(vectorStoreIdsResolved && {
                  vectorStoreIds: vectorStoreIdsResolved,
                }),
              },
            },
          });

    return result.toUIMessageStreamResponse({
      originalMessages: messages,
      generateMessageId: ((part: any) =>
        part.id ?? part.message?.id ?? crypto.randomUUID()) as any,
      onFinish: async ({ messages: finalMessages }) => {
        await saveChat({ id, messages: finalMessages });
      },
    });
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
