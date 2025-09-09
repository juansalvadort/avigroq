import type { ChatMessage } from '@/lib/types';

export function upsertMessage(
  list: ChatMessage[],
  incoming: ChatMessage,
): ChatMessage[] {
  const id = incoming.id ?? crypto.randomUUID();
  const index = list.findIndex((m) => m.id === id);
  const message: ChatMessage = { ...incoming, id };

  if (index !== -1) {
    const existing = list[index] as ChatMessage & { toolInvocations?: any[] };
    const incomingWithTools = message as ChatMessage & { toolInvocations?: any[] };

    const merged: ChatMessage & { toolInvocations?: any[] } = {
      ...existing,
      ...incomingWithTools,
      parts: [...(existing.parts ?? []), ...(incomingWithTools.parts ?? [])],
      ...(existing.toolInvocations || incomingWithTools.toolInvocations
        ? {
            toolInvocations: [
              ...(existing.toolInvocations ?? []),
              ...(incomingWithTools.toolInvocations ?? []),
            ],
          }
        : {}),
    };

    return [...list.slice(0, index), merged, ...list.slice(index + 1)];
  }

  return [...list, message];
}
