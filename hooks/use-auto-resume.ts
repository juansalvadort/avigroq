'use client';

import { useEffect, useRef } from 'react';
import type { UseChatHelpers } from '@ai-sdk/react';
import type { ChatMessage } from '@/lib/types';
import { useDataStream } from '@/components/data-stream-provider';

export interface UseAutoResumeParams {
  autoResume: boolean;
  initialMessages: ChatMessage[];
  resumeStream: UseChatHelpers<ChatMessage>['resumeStream'];
  setMessages: UseChatHelpers<ChatMessage>['setMessages'];
}

export function useAutoResume({
  autoResume,
  initialMessages,
  resumeStream,
  setMessages,
}: UseAutoResumeParams) {
  const { dataStream } = useDataStream();
  const processed = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (!autoResume) return;

    const mostRecentMessage = initialMessages.at(-1);

    if (mostRecentMessage?.role === 'user') {
      resumeStream();
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
