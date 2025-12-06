import PQueue from 'p-queue';
import { ReviewRequestOptions, ReviewTaskRecord } from '../types';

const queue = new PQueue({ concurrency: 3 });

export function setConcurrency(n: number) {
  queue.concurrency = n;
}

export function queueSize() {
  return {
    pending: queue.size,
    active: queue.pending,
  };
}

export function enqueue(fn: () => Promise<void>) {
  return queue.add(fn);
}

export function configureFromOptions(options?: ReviewRequestOptions) {
  if (options?.parallelism) queue.concurrency = options.parallelism;
}
