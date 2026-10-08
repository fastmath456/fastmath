import { setupWorker } from 'msw/browser';
import { HttpNetworkFrame } from 'msw/experimental';
import { handlers } from './handlers';

const worker = setupWorker(...handlers);
let start: ReturnType<typeof worker.start> | undefined;
export function startWorker() {
  start ??= worker.start({ onUnhandledFrame({ frame, defaults }) { if (frame instanceof HttpNetworkFrame && new URL(frame.data.request.url).pathname.startsWith('/__mock/')) defaults.error(); } });
  return start;
}
