import {
  AI_LIMIT_REACHED,
  SOCKET_EVENTS,
  type AiChunkPayload,
  type AiFailedPayload,
  type Ack,
} from '@teamchat/shared';
import { socket } from '../../lib/socket';
import { useAiFailuresStore } from '../../stores/aiFailures';
import { useAuthStore } from '../../stores/auth';
import { queryClient } from '../../lib/queryClient';
import { aiUsageKey } from '../assistant/usage';
import { patchMessage, removeMessage } from './messageCache';

/**
 * A piece of an @ai answer. Append it only if our copy ends exactly where it starts (`offset`):
 * if we joined mid-answer (or missed a piece while reconnecting) our copy is shorter, and
 * appending would garble the text, so we keep what we have and let the final message:updated
 * replace it.
 */
export function applyAiChunk({ channelId, messageId, delta, offset }: AiChunkPayload): void {
  patchMessage(channelId, messageId, (m) =>
    m.body.length === offset && m.ai
      ? { ...m, body: m.body + delta, ai: { ...m.ai, status: 'streaming' } }
      : m,
  );
}

/** The answer failed: the server removed the bot message; the asker gets a retry row. */
export function applyAiFailed({
  channelId,
  messageId,
  questionId,
  askedById,
  error,
}: AiFailedPayload) {
  if (messageId) removeMessage(channelId, messageId);
  if (askedById === useAuthStore.getState().user?.id) {
    useAiFailuresStore.getState().add(questionId, channelId, error);
    // Refused at the limit: make sure every meter shows it.
    if (error.code === AI_LIMIT_REACHED)
      void queryClient.invalidateQueries({ queryKey: aiUsageKey });
  }
}

/** Ask again for one of your @ai messages. */
export async function retryAiAnswer(questionId: string): Promise<void> {
  const failures = useAiFailuresStore.getState();
  const previous = failures.byQuestionId[questionId];
  failures.remove(questionId);
  try {
    const ack = (await socket
      .timeout(10_000)
      .emitWithAck(SOCKET_EVENTS.aiRetry, { questionId })) as Ack;
    if (!ack.ok) throw new Error(ack.error.message);
  } catch (err) {
    if (previous) {
      useAiFailuresStore.getState().add(questionId, previous.channelId, {
        code: 'RETRY_FAILED',
        message: err instanceof Error ? err.message : 'Retry failed',
      });
    }
  }
}
