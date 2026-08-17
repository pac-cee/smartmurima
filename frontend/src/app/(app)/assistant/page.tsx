'use client';

import { useState } from 'react';
import { useTranslations } from 'next-intl';
import { MessageCircle, Plus } from 'lucide-react';
import { AssistantChat } from '@/components/AssistantChat';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useSessions } from '@/hooks/useAssistant';
import { cn, relativeTime } from '@/lib/utils';

export default function AssistantPage() {
  const t = useTranslations('assistant');
  const { data: sessions, isLoading: sessionsLoading } = useSessions();
  const [activeSession, setActiveSession] = useState<string | undefined>(undefined);
  const [chatKey, setChatKey] = useState(0);

  const newChat = () => {
    setActiveSession(undefined);
    setChatKey((k) => k + 1);
  };

  return (
    <div className="grid h-[calc(100vh-9rem)] gap-6 lg:grid-cols-4">
      {/* sessions */}
      <div className="hidden flex-col lg:flex">
        <Button onClick={newChat} className="w-full">
          <Plus className="size-4" /> {t('newChat')}
        </Button>
        <div className="mt-4 space-y-1 overflow-y-auto">
          {sessionsLoading &&
            [0, 1, 2, 3].map((i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-2.5">
                <Skeleton className="mt-0.5 size-4 shrink-0 rounded-tile" />
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/3" />
                </div>
              </div>
            ))}
          {sessions?.map((s) => (
            <button
              key={s.id}
              onClick={() => {
                setActiveSession(s.id);
                setChatKey((k) => k + 1);
              }}
              className={cn(
                'flex w-full items-start gap-2 rounded-control px-3 py-2.5 text-left text-sm transition-colors',
                activeSession === s.id
                  ? 'bg-green-50 text-green-900'
                  : 'text-ink-700 hover:bg-green-50/60',
              )}
            >
              <MessageCircle className="mt-0.5 size-4 shrink-0 text-green-600" />
              <span className="min-w-0">
                <span className="block truncate font-medium">{s.title}</span>
                <span className="text-xs text-ink-500">{relativeTime(s.created_at)}</span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* chat */}
      <Card className="flex flex-col overflow-hidden p-4 lg:col-span-3">
        <div className="mb-2 flex items-center justify-between border-b border-line pb-3 lg:hidden">
          <p className="font-semibold text-ink-900">{t('title')}</p>
          <Button variant="ghost" size="sm" onClick={newChat}>
            <Plus className="size-4" /> {t('newChat')}
          </Button>
        </div>
        <AssistantChat key={chatKey} sessionId={activeSession} />
      </Card>
    </div>
  );
}
