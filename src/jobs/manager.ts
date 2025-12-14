import { ReviewRequestOptions } from '../types';

type TaskQueue = import('p-queue').default;

let queuePromise: Promise<TaskQueue> | undefined;

async function loadQueue() {
  if (!queuePromise) {
    queuePromise = import('p-queue').then(({ default: PQueue }) => new PQueue({ concurrency: 3 }));
  }
  return queuePromise;
}

export async function setConcurrency(n: number) {
  const queue = await loadQueue();
  queue.concurrency = n;
}

export async function queueSize() {
  const queue = await loadQueue();
  return {
    pending: queue.size,
    active: queue.pending,
  };
}

export async function enqueue(fn: () => Promise<void>) {
  const queue = await loadQueue();
  return queue.add(fn);
}

export async function configureFromOptions(options?: ReviewRequestOptions) {
  if (options?.parallelism) {
    await setConcurrency(options.parallelism);
  }
}
