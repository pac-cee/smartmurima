'use client';

import { useCallback, useRef, useState } from 'react';
import { useTranslations } from 'next-intl';
import { CheckCircle2, Leaf, Loader2, RotateCcw, TriangleAlert, UploadCloud } from 'lucide-react';
import { ConfidenceBar } from '@/components/ConfidenceBar';
import { Button } from '@/components/ui/button';
import { useDiseaseDetect } from '@/hooks/useDiseaseDetect';
import type { DiseaseReport } from '@/lib/schemas';
import { cn } from '@/lib/utils';

export function DiseaseUploadCard({ fieldId }: { fieldId: string | undefined }) {
  const t = useTranslations('diseases');
  const tc = useTranslations('common');
  const inputRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [result, setResult] = useState<DiseaseReport | null>(null);
  const detect = useDiseaseDetect();

  const handleFile = useCallback(
    (file: File) => {
      if (!file.type.startsWith('image/') || !fieldId) return;
      setResult(null);
      setPreview(URL.createObjectURL(file));
      detect.mutate(
        { field: fieldId, image: file },
        { onSuccess: (data) => setResult(data) },
      );
    },
    [detect, fieldId],
  );

  const reset = () => {
    setPreview(null);
    setResult(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div className="rounded-card border border-line bg-card p-5 shadow-sm">
      {!preview ? (
        <button
          type="button"
          disabled={!fieldId}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setDragging(false);
            const file = e.dataTransfer.files[0];
            if (file) handleFile(file);
          }}
          className={cn(
            'flex w-full flex-col items-center justify-center gap-3 rounded-tile border-2 border-dashed px-6 py-14 text-center transition-colors',
            dragging ? 'border-green-500 bg-green-50' : 'border-line hover:border-green-300 hover:bg-green-50/50',
            !fieldId && 'cursor-not-allowed opacity-60',
          )}
        >
          <span className="grid size-14 place-items-center rounded-pill bg-green-50 text-green-600">
            <UploadCloud className="size-7" />
          </span>
          <span className="text-base font-semibold text-ink-900">{t('drop')}</span>
          <span className="text-sm text-ink-500">{t('browse')}</span>
        </button>
      ) : (
        <div className="space-y-4">
          <div className="relative aspect-video w-full overflow-hidden rounded-tile border border-line bg-[var(--surface-muted)]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={preview} alt="Uploaded leaf" className="size-full object-cover" />
            {detect.isPending && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-ink-900/50 text-white">
                <Loader2 className="size-7 animate-spin" />
                <span className="text-sm font-medium">{t('analyzing')}</span>
              </div>
            )}
          </div>

          {result && (
            <div className="animate-slide-up space-y-3">
              <div className="flex items-start gap-3">
                <span
                  className={cn(
                    'grid size-10 shrink-0 place-items-center rounded-tile',
                    result.is_healthy ? 'bg-green-50 text-green-600' : 'bg-green-50 text-green-900',
                  )}
                >
                  {result.is_healthy ? (
                    <CheckCircle2 className="size-5" />
                  ) : (
                    <TriangleAlert className="size-5" />
                  )}
                </span>
                <div>
                  <p className="text-xs font-medium uppercase tracking-wide text-ink-500">
                    {result.is_healthy ? t('healthy') : t('detected')}
                  </p>
                  <p className="text-lg font-bold text-ink-900">{result.disease}</p>
                </div>
              </div>
              <ConfidenceBar value={result.confidence} label={tc('confidence')} />
              <div className="rounded-tile bg-green-50 p-4">
                <p className="mb-1 flex items-center gap-1.5 text-sm font-semibold text-green-900">
                  <Leaf className="size-4" /> {t('treatment')}
                </p>
                <p className="text-sm leading-relaxed text-ink-700">{result.treatment}</p>
              </div>
            </div>
          )}

          {detect.isError && (
            <p className="text-sm text-ink-700">Could not analyze the photo. Try another.</p>
          )}

          <Button variant="outline" onClick={reset} className="w-full">
            <RotateCcw className="size-4" /> {t('scanAnother')}
          </Button>
        </div>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
