import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as calendar from '../src/calendar/persian';
import { convertFrom } from '../src/converter/converter-core';

/**
 * `convertFrom` guards the Gregorian → Persian direction twice: it re-checks the
 * year it gets back, and it wraps the call in a catch. Neither guard can be
 * tripped by a date the UI can produce — 1822-01-01 CE is 1200-10-11 AP and
 * 2121-12-31 CE is 1500-10-10 AP, so the whole accepted Gregorian range lands
 * inside the supported Persian one, and `toPersian` asserts that range itself.
 *
 * They are a contract with the calendar module, not with the user, so they are
 * tested the way a contract is: by making the dependency break it. Deleting them
 * instead would leave an input handler one calendar change away from taking the
 * page down.
 */
vi.mock('../src/calendar/persian', async (importOriginal) => {
  const actual = await importOriginal<typeof calendar>();
  return { ...actual, toPersian: vi.fn(actual.toPersian) };
});

const toPersian = vi.mocked(calendar.toPersian);

beforeEach(() => {
  toPersian.mockReset();
});

describe('the Gregorian side against a misbehaving calendar', () => {
  it('reports rather than trusting a Persian year outside the supported range', () => {
    toPersian.mockReturnValue({ py: 1501, pm: 1, pd: 1 });

    expect(convertFrom('gregorian', { y: '2000', m: '1', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errUnsupported', side: 'gregorian' });
  });

  it('reports rather than trusting a Persian year below the supported range', () => {
    toPersian.mockReturnValue({ py: 1199, pm: 12, pd: 29 });

    expect(convertFrom('gregorian', { y: '2000', m: '1', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errUnsupported', side: 'gregorian' });
  });

  it('stays total when the calendar throws', () => {
    toPersian.mockImplementation(() => { throw new RangeError('boom'); });

    expect(convertFrom('gregorian', { y: '2000', m: '1', d: '1' }))
      .toMatchObject({ status: 'error', errorKey: 'errUnsupported', side: 'gregorian' });
  });
});

describe('the range containment the guards stand in for', () => {
  it('maps both ends of the accepted Gregorian range inside 1200–1500', async () => {
    const actual = await vi.importActual<typeof calendar>('../src/calendar/persian');
    toPersian.mockImplementation(actual.toPersian);

    expect(convertFrom('gregorian', { y: '1822', m: '1', d: '1' }))
      .toMatchObject({ status: 'ok', persian: { py: 1200, pm: 10, pd: 11 } });
    expect(convertFrom('gregorian', { y: '2121', m: '12', d: '31' }))
      .toMatchObject({ status: 'ok', persian: { py: 1500, pm: 10, pd: 10 } });
  });
});
