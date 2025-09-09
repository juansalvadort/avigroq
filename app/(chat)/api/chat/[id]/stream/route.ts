export const runtime = 'nodejs';
import { auth } from '@/app/(auth)/auth';
import {
  getChatById,
  getMessagesByChatId,
  getStreamIdsByChatId,
} from '@/lib/db/queries';
import type { Chat } from '@/lib/db/schema';
import { ChatSDKError } from '@/lib/errors';
import type { ChatMessage } from '@/lib/types';
import { createUIMessageStream, JsonToSseTransformStream } from 'ai';
import { getStreamContext } from '../../route';
import { differenceInSeconds } from 'date-fns';
import type { ResumableStreamContext } from 'resumable-stream';

async function getStreamForChat({
  ctx,
  streamId,
  startFromId,
  emptyDataStream,
}: {
  ctx: ResumableStreamContext;
  streamId: string;
  startFromId?: string;
  emptyDataStream: ReadableStream<unknown>;
}) {
  const skipCharacters = startFromId ? Number(startFromId) : undefined;
  return ctx.resumableStream(
    streamId,
    () => emptyDataStream.pipeThrough(new JsonToSseTransformStream()),
    skipCharacters,
  );
}

function toDataStreamResponse(stream: ReadableStream<any>, {
  startFromId,
  status = 200,
}: {
  startFromId?: string;
  status?: number;
}) {
  const headers: Record<string, string> = {
    'Content-Type': 'text/event-stream',
  };
  if (startFromId) {
    headers['X-Start-From-Id'] = startFromId;
  }
  return new Response(stream, { status, headers });
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id: chatId } = await params;
  const { searchParams } = new URL(request.url);
  const fromEventId = searchParams.get('fromEventId');
  const lastEventId =
    request.headers.get('last-event-id') ||
    request.headers.get('Last-Event-ID');
  const startFromId = fromEventId || lastEventId || undefined;

  const streamContext = getStreamContext();
  const resumeRequestedAt = new Date();

  if (!streamContext) {
    return new Response(null, { status: 204 });
  }

  if (!chatId) {
    return new ChatSDKError('bad_request:api').toResponse();
  }

  const session = await auth();

  if (!session?.user) {
    return new ChatSDKError('unauthorized:chat').toResponse();
  }

  let chat: Chat;

  try {
    chat = await getChatById({ id: chatId });
  } catch {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (!chat) {
    return new ChatSDKError('not_found:chat').toResponse();
  }

  if (chat.visibility === 'private' && chat.userId !== session.user.id) {
    return new ChatSDKError('forbidden:chat').toResponse();
  }

  const streamIds = await getStreamIdsByChatId({ chatId });

  if (!streamIds.length) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const recentStreamId = streamIds.at(-1);

  if (!recentStreamId) {
    return new ChatSDKError('not_found:stream').toResponse();
  }

  const emptyDataStream = createUIMessageStream<ChatMessage>({
    execute: () => {},
  });

  const stream = await getStreamForChat({
    ctx: streamContext,
    streamId: recentStreamId,
    startFromId,
    emptyDataStream,
  });

  /*
   * For when the generation is streaming during SSR
   * but the resumable stream has concluded at this point.
   */
  if (!stream) {
    const messages = await getMessagesByChatId({ id: chatId });
    const mostRecentMessage = messages.at(-1);

    if (!mostRecentMessage) {
      return toDataStreamResponse(emptyDataStream, { status: 200 });
    }

    if (mostRecentMessage.role !== 'assistant') {
      return toDataStreamResponse(emptyDataStream, { status: 200 });
    }

    const messageCreatedAt = new Date(mostRecentMessage.createdAt);

    if (differenceInSeconds(resumeRequestedAt, messageCreatedAt) > 15) {
      return toDataStreamResponse(emptyDataStream, { status: 200 });
    }

    const restoredStream = createUIMessageStream<ChatMessage>({
      execute: ({ writer }) => {
        writer.write({
          type: 'data-appendMessage',
          data: JSON.stringify(mostRecentMessage),
          transient: true,
        });
      },
    });

    return toDataStreamResponse(restoredStream, { status: 200 });
  }

  return toDataStreamResponse(stream, { startFromId, status: 200 });
}
