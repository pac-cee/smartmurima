'use client';

import { useEffect, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useLocale } from 'next-intl';
import { BookOpen, Send, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useSendMessage, useSessionMessages } from '@/hooks/useAssistant';
import type { ChatMessage, Source } from '@/lib/schemas';
import { cn } from '@/lib/utils';

function SourceChip({ source }: { source: Source }) {
  return (
    <span
      title={source.snippet}
      className="inline-flex items-center gap-1 rounded-pill border border-line bg-white px-2.5 py-1 text-xs text-ink-700 transition-colors hover:border-green-300 hover:bg-green-50"
    >
      <BookOpen className="size-3 text-green-600" />
      {source.title}
    </span>
  );
}

function TypingDots() {
  return (
    <span className="inline-flex gap-1" aria-label="Assistant is typing">
      {[0, 1, 2].map((i) => (
        <span
          key={i}
          className="size-1.5 animate-bounce rounded-pill bg-green-500"
          style={{ animationDelay: `${i * 120}ms` }}
        />
      ))}
    </span>
  );
}

function Bubble({ message, streamed }: { message: ChatMessage; streamed?: string }) {
  const isUser = message.role === 'user';
  const content = streamed ?? message.content;
  return (
    <div className={cn('flex w-full', isUser ? 'justify-end' : 'justify-start')}>
      <div className={cn('max-w-[85%] space-y-2 sm:max-w-[75%]')}>
        <div
          className={cn(
            'rounded-card px-4 py-3 text-sm leading-relaxed shadow-sm',
            isUser
              ? 'rounded-br-md bg-green-50 text-ink-900'
              : 'rounded-bl-md border border-line bg-card text-ink-900',
          )}
        >
          {content}
        </div>
        {!isUser && message.sources && message.sources.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {message.sources.map((s) => (
              <SourceChip key={s.ref} source={s} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function AssistantChat({ sessionId }: { sessionId?: string }) {
  const t = useTranslations('assistant');
  const locale = useLocale() as 'rw' | 'en';
  const { data: history } = useSessionMessages(sessionId);
  const send = useSendMessage();
  const [session, setSession] = useState<string | undefined>(sessionId);
  const [localMessages, setLocalMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [streamed, setStreamed] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const messages = history && localMessages.length === 0 ? history : localMessages;

  useEffect(() => {
    if (history && localMessages.length === 0) setLocalMessages(history);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [history]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
  }, [messages, streamed, send.isPending]);

  const submit = (question: string) => {
    const q = question.trim();
    if (!q || send.isPending) return;
    const userMsg: ChatMessage = {
      id: `local-${Date.now()}`,
      role: 'user',
      content: q,
      created_at: new Date().toISOString(),
    };
    setLocalMessages((prev) => [...prev, userMsg]);
    setInput('');

    send.mutate(
      { question: q, language: locale, session },
      {
        onSuccess: (data) => {
          setSession(data.session);
          // simulate streaming of the answer
          const words = data.answer.split(' ');
          let i = 0;
          setStreamed('');
          const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
          if (reduce) {
            setStreamed(null);
            setLocalMessages((prev) => [
              ...prev,
              {
                id: `a-${Date.now()}`,
                role: 'assistant',
                content: data.answer,
                sources: data.sources,
                created_at: new Date().toISOString(),
              },
            ]);
            return;
          }
          const interval = setInterval(() => {
            i += 1;
            setStreamed(words.slice(0, i).join(' '));
            if (i >= words.length) {
              clearInterval(interval);
              setStreamed(null);
              setLocalMessages((prev) => [
                ...prev,
                {
                  id: `a-${Date.now()}`,
                  role: 'assistant',
                  content: data.answer,
                  sources: data.sources,
                  created_at: new Date().toISOString(),
                },
              ]);
            }
          }, 35);
        },
      },
    );
  };

  const suggestions = [t('suggestions.s1'), t('suggestions.s2'), t('suggestions.s3')];

  return (
    <div className="flex h-full flex-col">
      <div ref={scrollRef} className="flex-1 space-y-5 overflow-y-auto px-1 py-2">
        {messages.length === 0 && !send.isPending && (
          <div className="flex h-full flex-col items-center justify-center gap-5 py-10 text-center">
            <span className="grid size-14 place-items-center rounded-pill bg-green-50 text-green-600">
              <Sparkles className="size-7" />
            </span>
            <div>
              <p className="text-lg font-semibold text-ink-900">{t('title')}</p>
              <p className="mt-1 max-w-sm text-sm text-ink-500">{t('subtitle')}</p>
            </div>
            <div className="flex flex-wrap justify-center gap-2">
              {suggestions.map((s) => (
                <button
                  key={s}
                  onClick={() => submit(s)}
                  className="rounded-pill border border-line bg-card px-3.5 py-2 text-sm text-ink-700 transition-colors hover:border-green-300 hover:bg-green-50"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <Bubble key={m.id} message={m} />
        ))}

        {send.isPending && streamed === null && (
          <div className="flex justify-start">
            <div className="rounded-card rounded-bl-md border border-line bg-card px-4 py-3 shadow-sm">
              <TypingDots />
            </div>
          </div>
        )}
        {streamed !== null && (
          <Bubble
            message={{
              id: 'streaming',
              role: 'assistant',
              content: streamed,
              created_at: new Date().toISOString(),
            }}
          />
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          submit(input);
        }}
        className="mt-3 flex items-end gap-2 border-t border-line pt-3"
      >
        <Textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
              e.preventDefault();
              submit(input);
            }
          }}
          placeholder={t('placeholder')}
          rows={1}
          className="min-h-[44px] resize-none"
          aria-label={t('placeholder')}
        />
        <Button type="submit" size="icon" disabled={!input.trim() || send.isPending}>
          <Send className="size-4" />
          <span className="sr-only">{t('send')}</span>
        </Button>
      </form>
    </div>
  );
}
