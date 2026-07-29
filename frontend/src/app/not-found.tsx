import Link from 'next/link';
import { Leaf } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-paper px-6 text-center">
      <span className="grid size-16 place-items-center rounded-pill bg-green-50 text-green-600">
        <Leaf className="size-8" />
      </span>
      <div>
        <p className="text-4xl font-bold text-ink-900">404</p>
        <p className="mt-1 text-ink-500">We couldn&apos;t find that page.</p>
      </div>
      <Link
        href="/dashboard"
        className="inline-flex h-11 items-center rounded-control bg-green-600 px-5 text-sm font-medium text-white transition-colors hover:bg-green-700"
      >
        Back to dashboard
      </Link>
    </div>
  );
}
