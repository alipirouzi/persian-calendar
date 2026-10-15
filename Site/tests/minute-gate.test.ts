import { describe, expect, it, vi } from 'vitest';
import { createMinuteGate } from '../src/time/minute-gate';

const at = (iso: string): Date => new Date(iso);

describe('createMinuteGate', () => {
  it('passes the first date and then only the first date of each new minute', () => {
    const onChange = vi.fn();
    const tick = createMinuteGate(onChange);

    tick(at('2026-03-20T20:29:57.000Z'));
    tick(at('2026-03-20T20:29:59.999Z'));
    tick(at('2026-03-20T20:30:00.000Z'));
    tick(at('2026-03-20T20:30:30.000Z'));

    expect(onChange.mock.calls.map(([d]) => (d as Date).toISOString())).toEqual([
      '2026-03-20T20:29:57.000Z', '2026-03-20T20:30:00.000Z',
    ]);
  });

  it('passes a jump backwards too, as after a sync corrects a fast clock', () => {
    const onChange = vi.fn();
    const tick = createMinuteGate(onChange);
    tick(at('2026-03-21T00:00:05.000Z'));
    tick(at('2026-03-20T23:59:58.000Z'));
    expect(onChange).toHaveBeenCalledTimes(2);
  });
});
