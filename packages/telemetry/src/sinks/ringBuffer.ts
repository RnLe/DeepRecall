import type { LogEvent, Sink } from "../logger";

export interface RingBufferSink extends Sink {
  dump: () => LogEvent[];
  clear: () => void;
}

export function makeRingBufferSink(capacity = 2000): RingBufferSink {
  const buf: LogEvent[] = new Array(capacity);
  let i = 0;
  let filled = false;

  return {
    write(e: LogEvent) {
      buf[i] = e;
      i = (i + 1) % capacity;
      if (i === 0) filled = true;
    },
    dump() {
      return filled ? [...buf.slice(i), ...buf.slice(0, i)] : buf.slice(0, i);
    },
    clear() {
      i = 0;
      filled = false;
      buf.fill(null as any);
    },
  };
}
