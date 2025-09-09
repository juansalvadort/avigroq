'use client';

import { useEffect, useRef } from 'react';
import { createParser, type EventSourceMessage } from 'eventsource-parser';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from '@/components/data-stream-provider';

let lastEventId: string | null = null;

export interface UseAutoResumeParams {
  autoResume: boolean;
  chatId: string;
  initialMessages: ChatMessage[];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

export function useAutoResume({
  autoResume,
  chatId,
  initialMessages,
  setMessages,
}: UseAutoResumeParams) {
  const { dataStream } = useDataStream();
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!autoResume) return;

    const mostRecentMessage = initialMessages.at(-1);

    if (mostRecentMessage?.role === 'user') {
      (async () => {
        const url = lastEventId
          ? `/api/chat/${chatId}/stream?fromEventId=${lastEventId}`
          : `/api/chat/${chatId}/stream`;

        const res = await fetch(url, {
          headers: lastEventId ? { 'Last-Event-ID': lastEventId } : undefined,
        });

        const stream = res.body;
        if (!stream) return;

        const reader = stream.getReader();
        const decoder = new TextDecoder();
        const parser = createParser({
          onEvent(evt: EventSourceMessage) {
            if (evt.id) {
              lastEventId = evt.id;
            }

            try {
              const part = JSON.parse(evt.data);
              if (part.type !== 'data-appendMessage') return;

              const message = JSON.parse(part.data);
              const key = `${message.id}:${message.parts?.length ?? 0}`;
              if (processed.current.has(key)) return;
              processed.current.add(key);

              setMessages((prev) => {
                const idx = prev.findIndex((m) => m.id === message.id);
                if (idx === -1) {
                  return [...prev, message];
                }

                const updated = [...prev];
                updated[idx] = message;
                return updated;
              });
            } catch {
              // ignore malformed JSON
            }
          },
        });

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          parser.feed(decoder.decode(value, { stream: true }));
        }
      })();
    }

    // we intentionally run this once
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!dataStream) return;

    for (const part of dataStream) {
      if (part.type !== 'data-appendMessage') continue;

      try {
        const message = JSON.parse(part.data);
        const key = `${message.id}:${message.parts?.length ?? 0}`;
        if (processed.current.has(key)) continue;
        processed.current.add(key);

        setMessages((prev) => {
          const idx = prev.findIndex((m) => m.id === message.id);
          if (idx === -1) {
            return [...prev, message];
          }

          const updated = [...prev];
          updated[idx] = message;
          return updated;
        });
      } catch {
        // ignore malformed JSON
      }
    }
  }, [dataStream, setMessages]);

  useEffect(() => {
    if (!dataStream || dataStream.length === 0) {
      processed.current.clear();
    }
  }, [dataStream]);
}
