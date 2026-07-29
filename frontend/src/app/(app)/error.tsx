'use client';

import { useEffect } from 'react';
import { RefreshCw, TriangleAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <span className="grid size-14 place-items-center rounded-pill bg-green-50 text-green-900">
        <TriangleAlert className="size-7" />
      </span>
      <div>
        <p className="text-lg font-semibold text-ink-900">This screen ran into a problem</p>
        <p className="mt-1 max-w-sm text-sm text-ink-500">
          The rest of the app is still working. You can reload this section.
        </p>
      </div>
      <Button onClick={reset}>
        <RefreshCw className="size-4" /> Try again
      </Button>
    </div>
  );
}
