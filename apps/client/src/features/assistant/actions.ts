import {
  AI_CONVERSATION_HEADER,
  AI_LIMIT_REACHED,
  aiConversationResponseSchema,
} from '@teamchat/shared';
import { api, ApiError } from '../../lib/api';
import { queryClient } from '../../lib/queryClient';
import { StreamCutError, streamText } from '../../lib/streamText';
import { assistantBusy, useAssistantStore, type ChatMessage } from '../../stores/assistant';
import { useAuthStore } from '../../stores/auth';
import { setAiUsageFromError } from './usage';

export const aiConversationsKey = ['ai-conversations'] as const;

const store = useAssistantStore;
let nextKey = 0;
const key = () => `m${++nextKey}`;

/** The stream in flight (Stop aborts it). */
let inflight: AbortController | null = null;

// ---------------------------------------------------------------------------------------------
// Remember the open conversation per user, so a reload shows it again.
// ---------------------------------------------------------------------------------------------
const lastKey = () => `teamchat:assistant:${useAuthStore.getState().user?.id ?? 'anon'}`;

function rememberConversation(id: string | null) {
  try {
    if (id) localStorage.setItem(lastKey(), id);
    else localStorage.removeItem(lastKey());
  } catch {
    // storage blocked: not remembered
  }
}

export function rememberedConversation(): string | null {
  try {
    return localStorage.getItem(lastKey());
  } catch {
    return null;
  }
}

/** Same rule as the server's title (first question, one line, 80 chars). */
const titleOf = (question: string) => {
  const oneLine = question.replace(/\s+/g, ' ').trim();
  return oneLine.length > 80 ? `${oneLine.slice(0, 79)}…` : oneLine;
};

/** The browser only sees text, so tokens are estimated (~4 characters per token). */
export const estimateTokens = (chars: number) => Math.max(1, Math.round(chars / 4));

function failureFor(err: unknown, question: string) {
  if (err instanceof StreamCutError) return null; // handled by the caller (needs the partial)
  const message =
    err instanceof ApiError
      ? err.code === 'AI_BUSY'
        ? 'The AI service is busy. Try again in a moment.'
        : err.code === 'AI_TIMEOUT'
          ? 'That took too long, so it was stopped.'
          : err.message
      : 'Something went wrong. Try again.';
  return { kind: 'error' as const, title: message, question };
}

/**
 * Sends a question and streams the answer into the store.
 *
 * Text arrives in many small pieces; re-rendering the markdown for each one would be wasteful,
 * so pieces are collected and applied once per animation frame (at most ~60 renders a second).
 */
export async function ask(question: string): Promise<void> {
  const text = question.trim();
  const state = store.getState();
  if (!text || assistantBusy(state.status) || state.status === 'loading') return;

  const userMessage: ChatMessage = { key: key(), role: 'user', content: text };
  const answerKey = key();
  store.setState({
    view: 'chat',
    messages: [...state.messages, userMessage],
    status: 'waiting',
    failure: null,
    draft: '',
    tokensPerSecond: null,
    title: state.title ?? titleOf(text),
  });

  const controller = new AbortController();
  inflight = controller;
  let answer = '';
  let pending = '';
  let frame = 0;
  let firstChunkAt = 0;

  const flush = () => {
    frame = 0;
    if (!pending) return;
    answer += pending;
    pending = '';
    const seconds = (performance.now() - firstChunkAt) / 1000;
    store.setState((s) => {
      const last = s.messages.at(-1);
      const messages =
        last?.key === answerKey
          ? [...s.messages.slice(0, -1), { ...last, content: answer }]
          : [...s.messages, { key: answerKey, role: 'assistant' as const, content: answer }];
      return {
        messages,
        status: 'streaming',
        tokensPerSecond:
          seconds > 0.25 ? Math.round(estimateTokens(answer.length) / seconds) : null,
      };
    });
  };

  try {
    await streamText('/ai/chat', {
      body: {
        message: text,
        ...(state.conversationId && { conversationId: state.conversationId }),
      },
      signal: controller.signal,
      onOpen: (headers) => {
        const id = headers.get(AI_CONVERSATION_HEADER);
        if (id && id !== store.getState().conversationId) {
          store.setState({ conversationId: id });
          rememberConversation(id);
        }
      },
      onChunk: (piece) => {
        firstChunkAt ||= performance.now();
        pending += piece;
        frame ||= requestAnimationFrame(flush);
      },
    });
    cancelAnimationFrame(frame);
    flush();
    store.setState({ status: 'idle', tokensPerSecond: null });
  } catch (err) {
    cancelAnimationFrame(frame);
    flush();
    if (controller.signal.aborted) {
      // Stop: keep what arrived, labelled "stopped" (the server saved the same partial). Stopped
      // before any text: nothing was saved, so take the question back into the ask box.
      store.setState((s) =>
        answer
          ? {
              messages: s.messages.map((m) => (m.key === answerKey ? { ...m, stopped: true } : m)),
              status: 'idle',
              tokensPerSecond: null,
            }
          : {
              messages: s.messages.filter((m) => m.key !== userMessage.key),
              status: 'idle',
              tokensPerSecond: null,
              draft: text,
              title: s.messages.length > 1 ? s.title : null,
            },
      );
    } else if (err instanceof StreamCutError) {
      // The server saved the partial answer marked stopped (it saw the connection end), so
      // show it the same way; Retry then adds a new exchange after it.
      store.setState((s) => ({
        messages: s.messages.map((m) => (m.key === answerKey ? { ...m, stopped: true } : m)),
        status: 'idle',
        tokensPerSecond: null,
        failure: {
          kind: 'cut',
          title: 'The answer was cut off.',
          detail: `connection lost after ~${estimateTokens(answer.length)} tokens`,
          question: text,
        },
      }));
    } else if (err instanceof ApiError && err.code === AI_LIMIT_REACHED) {
      // Daily allowance used up: nothing was sent to the AI or saved. The panel shows the
      // limit card (from the usage numbers); the question goes back into the box.
      setAiUsageFromError(err.details);
      store.setState((s) => ({
        messages: s.messages.filter((m) => m.key !== userMessage.key),
        status: 'idle',
        tokensPerSecond: null,
        draft: text,
        title: s.messages.length > 1 ? s.title : null,
      }));
    } else {
      store.setState({ status: 'idle', tokensPerSecond: null, failure: failureFor(err, text) });
    }
  } finally {
    if (inflight === controller) inflight = null;
    void queryClient.invalidateQueries({ queryKey: aiConversationsKey });
  }
}

/** Stop / Esc: abort the request (the server stops Gemini and saves the partial answer). */
export function stop(): void {
  inflight?.abort();
}

/**
 * Retry resends the same question.
 * - Cut off mid-answer: the partial stays (the server saved it too); a new exchange follows.
 * - Failed before any text: the server saved nothing, so drop the question and ask again.
 */
export function retry(): void {
  const failure = store.getState().failure;
  if (!failure) return;
  store.setState((s) => {
    if (failure.kind === 'cut') return { failure: null };
    const lastQuestion = s.messages.map((m) => m.role).lastIndexOf('user');
    return {
      failure: null,
      messages: lastQuestion >= 0 ? s.messages.slice(0, lastQuestion) : s.messages,
    };
  });
  void ask(failure.question);
}

export function newConversation(): void {
  stop();
  rememberConversation(null);
  store.getState().reset();
}

/** Loads a saved conversation into the panel (from the list, or the remembered one on load). */
export async function openConversation(id: string): Promise<void> {
  stop();
  store.setState({
    view: 'chat',
    conversationId: id,
    title: null,
    messages: [],
    status: 'loading',
    failure: null,
    draft: '',
  });
  rememberConversation(id);
  try {
    const { conversation } = await api(`/ai/conversations/${id}`, {}, aiConversationResponseSchema);
    if (store.getState().conversationId !== id) return; // switched again meanwhile
    store.setState({
      title: conversation.title,
      status: 'idle',
      messages: conversation.messages.map((m) => ({
        key: key(),
        role: m.role,
        content: m.content,
        ...(m.stopped && { stopped: true }),
      })),
    });
  } catch (err) {
    if (store.getState().conversationId !== id) return;
    // Gone (or not yours any more): start fresh instead of showing an error.
    if (err instanceof ApiError && err.status === 404) newConversation();
    else store.setState({ status: 'idle' }); // e.g. offline: a reload tries again
  }
}

/** Sign-out: stop streaming and forget the panel's conversation (not the open/closed choice). */
export function resetAssistant(): void {
  stop();
  store.getState().reset();
}
