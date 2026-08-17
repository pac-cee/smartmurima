'use client';

import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

// Administration lives in the Django admin, not this farmer-facing app. This
// route only exists to redirect anyone who still has the old link bookmarked.
const DJANGO_ADMIN_URL =
  process.env.NEXT_PUBLIC_DJANGO_ADMIN_URL ?? 'http://localhost:8000/admin';

export default function AdminRedirectPage() {
  useEffect(() => {
    window.location.assign(DJANGO_ADMIN_URL);
  }, []);

  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 text-center">
      <Loader2 className="size-6 animate-spin text-green-600" />
      <div>
        <p className="text-base font-semibold text-ink-900">Redirecting to the admin console…</p>
        <p className="mt-1 text-sm text-ink-500">
          If nothing happens,{' '}
          <a href={DJANGO_ADMIN_URL} className="font-medium text-green-700 hover:underline">
            open it here
          </a>
          .
        </p>
      </div>
    </div>
  );
}
