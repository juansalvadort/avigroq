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
  const processedIndexRef = useRef(0);

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

    for (let i = processedIndexRef.current; i < dataStream.length; i++) {
      const dataPart = dataStream[i];

      if (dataPart.type === 'data-appendMessage') {
        const message = JSON.parse(dataPart.data);
        setMessages((prev) => [...prev, message]);
      }
    }

    processedIndexRef.current = dataStream.length;
  }, [dataStream, setMessages]);

  useEffect(() => {
    if (!dataStream || dataStream.length === 0) {
      processedIndexRef.current = 0;
    }
  }, [dataStream]);
}
