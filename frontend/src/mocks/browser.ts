import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export const worker = setupWorker(...handlers);

// Memoize start() at module scope so it runs exactly once, even though React 18
// Strict Mode invokes effects twice in development. Calling worker.start() a
// second time throws: "cannot configure an already enabled network."
let startPromise: Promise<unknown> | null = null;

export function startWorker() {
  if (!startPromise) {
    startPromise = worker.start({ onUnhandledRequest: 'bypass', quiet: true });
  }
  return startPromise;
}
