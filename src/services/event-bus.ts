import { EventEmitter } from 'events';

export type EventPayload = {
  type: string;
  data: any;
};

const emitter = new EventEmitter();

export function emitEvent(event: EventPayload) {
  emitter.emit('event', event);
}

export function onEvent(listener: (event: EventPayload) => void) {
  emitter.on('event', listener);
  return () => emitter.off('event', listener);
}
