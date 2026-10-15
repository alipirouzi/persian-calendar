import type { SettingsStore } from '../settings/settings-store';
import {
  applyDeadBand, bestSample, isFresh, parseTimeBody, RESYNC_AFTER_HIDDEN_MS, RESYNC_INTERVAL_MS,
  SAMPLE_TIMEOUT_MS, sampleOffset, SAMPLES_PER_SYNC, TIME_ENDPOINT, type LastSync, type Sample,
} from './time-sync-model';

export type TimeStatus =
  | { readonly kind: 'device' }
  | { readonly kind: 'syncing' }
  | { readonly kind: 'synced'; readonly atMs: number; readonly offsetMs: number }
  | { readonly kind: 'unsynced' };

export type ProbeResult =
  | { readonly ok: true; readonly rttMs: number; readonly offsetMs: number }
  | { readonly ok: false };

export interface TimeSourceDeps {
  readonly store: Pick<SettingsStore, 'get' | 'subscribe'>;
  readonly fetchImpl?: typeof fetch;
  readonly dateNow?: () => number;
  readonly perfNow?: () => number;
}

export interface TimeSource {
  now(): Date;
  status(): TimeStatus;
  subscribe(listener: () => void): () => void;
  sync(): Promise<void>;
  probe(): Promise<ProbeResult>;
  start(): void;
  dispose(): void;
}

/** How often the six-hour rule is checked; a throttled tick only delays the check. */
const SCHEDULE_CHECK_MS = 60_000;

export function createTimeSource({
  store,
  fetchImpl = (input, init) => fetch(input, init),
  dateNow = () => Date.now(),
  perfNow = () => performance.now(),
}: TimeSourceDeps): TimeSource {
  let last: LastSync | null = null;
  let running: { generation: number; done: Promise<void> } | null = null;
  // Bumped on every source switch: a run started before the switch must not land after it.
  let generation = 0;
  let source = store.get().time.source;
  let lastAttemptMs = Number.NEGATIVE_INFINITY;
  let hiddenSinceMs: number | null = null;
  let intervalId: ReturnType<typeof setInterval> | undefined;
  const listeners = new Set<() => void>();

  const notify = (): void => { for (const listener of listeners) listener(); };
  const usingServer = (): boolean => source === 'server';
  const offsetNow = (): number => (usingServer() && isFresh(last, dateNow()) ? last!.offsetMs : 0);

  const takeSample = async (): Promise<Sample | null> => {
    const controller = new AbortController();
    const timer = setTimeout(() => { controller.abort(); }, SAMPLE_TIMEOUT_MS);
    try {
      const t0 = perfNow();
      const response = await fetchImpl(TIME_ENDPOINT, { cache: 'no-store', signal: controller.signal });
      if (!response.ok) return null;
      const serverMs = parseTimeBody(await response.json());
      const t1 = perfNow();
      return serverMs === null ? null : sampleOffset(serverMs, t0, t1, dateNow());
    } catch {
      // Offline, timed out, or a body that is not JSON (a Wi-Fi login page): no sample.
    } finally {
      clearTimeout(timer);
    }
    return null;
  };

  const adopt = (sample: Sample): void => {
    last = { offsetMs: applyDeadBand(sample.offsetMs), atDeviceMs: dateNow() };
  };

  const sync = (): Promise<void> => {
    if (!usingServer()) return Promise.resolve();
    if (running?.generation === generation) return running.done;
    // `running` is set before the first notify and cleared before the last, so a listener
    // reading status() sees "syncing" while it runs and the outcome once it has finished.
    // It is cleared in `finally` so a throwing listener cannot leave the run wedged.
    const mine = { generation, done: Promise.resolve() };
    running = mine;
    mine.done = (async () => {
      try {
        lastAttemptMs = dateNow();
        notify();
        const samples: Sample[] = [];
        for (let i = 0; i < SAMPLES_PER_SYNC; i += 1) {
          const sample = await takeSample();
          if (sample !== null) samples.push(sample);
        }
        const best = bestSample(samples);
        if (best !== null && mine.generation === generation) adopt(best);
      } finally {
        if (running === mine) running = null;
      }
      notify();
    })();
    return mine.done;
  };

  const onVisibility = (): void => {
    if (document.hidden) {
      hiddenSinceMs = dateNow();
      return;
    }
    if (hiddenSinceMs === null) return;
    const hiddenFor = dateNow() - hiddenSinceMs;
    hiddenSinceMs = null;
    // Resync after a long absence; after the device clock went back while hidden (a negative
    // span); or when the device is known to be off, since the user may just have set it by hand.
    // Only Date.now() is compared: iOS pauses performance.now() while the app is suspended.
    const knownOff = last !== null && last.offsetMs !== 0;
    if (hiddenFor >= RESYNC_AFTER_HIDDEN_MS || hiddenFor < 0 || knownOff) void sync();
  };

  const onScheduleCheck = (): void => {
    if (document.hidden) return;
    // A negative span means the device clock went back since the last attempt.
    const sinceAttempt = dateNow() - lastAttemptMs;
    if (sinceAttempt >= RESYNC_INTERVAL_MS || sinceAttempt < 0) void sync();
  };

  const onOnline = (): void => { void sync(); };

  const unsubscribeStore = store.subscribe((settings) => {
    if (settings.time.source === source) return;
    source = settings.time.source;
    generation += 1;
    notify();
    void sync();
  });

  return {
    now: () => new Date(dateNow() + offsetNow()),
    status(): TimeStatus {
      if (!usingServer()) return { kind: 'device' };
      if (isFresh(last, dateNow())) {
        return { kind: 'synced', atMs: last!.atDeviceMs + last!.offsetMs, offsetMs: last!.offsetMs };
      }
      return running === null ? { kind: 'unsynced' } : { kind: 'syncing' };
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => { listeners.delete(listener); };
    },
    sync,
    async probe(): Promise<ProbeResult> {
      const sample = await takeSample();
      if (sample === null) return { ok: false };
      if (usingServer()) {
        adopt(sample);
        notify();
      }
      return { ok: true, rttMs: Math.round(sample.rttMs), offsetMs: applyDeadBand(sample.offsetMs) };
    },
    start() {
      document.addEventListener('visibilitychange', onVisibility);
      window.addEventListener('online', onOnline);
      intervalId = setInterval(onScheduleCheck, SCHEDULE_CHECK_MS);
      void sync();
    },
    dispose() {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('online', onOnline);
      clearInterval(intervalId);
      unsubscribeStore();
      listeners.clear();
    },
  };
}
