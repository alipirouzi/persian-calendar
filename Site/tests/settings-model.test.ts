import { describe, expect, it } from 'vitest';
import {
  DEFAULT_SETTINGS, MAX_PATTERN_LENGTH, parseSettings,
} from '../src/settings/settings-model';

describe('parseSettings', () => {
  it('defaults everything when given nothing usable', () => {
    for (const raw of [undefined, null, 42, 'x', [], {}, { copy: 'x' }, { copy: [] }]) {
      expect(parseSettings(raw)).toEqual(DEFAULT_SETTINGS);
    }
  });

  it('keeps every valid field', () => {
    const raw = {
      copy: { calendar: 'both', pattern: 'dd.mm.yyyy', digits: 'persian' },
      time: { source: 'device' },
    };
    expect(parseSettings(raw)).toEqual(raw);
  });

  it('replaces only the invalid fields', () => {
    const parsed = parseSettings({ copy: { calendar: 'julian', pattern: 'yyyy', digits: 7 } });
    expect(parsed.copy).toEqual({ calendar: 'persian', pattern: 'yyyy', digits: 'latin' });
  });

  it('falls back to the default pattern when it is empty, blank, too long or not a string', () => {
    for (const pattern of ['', '   ', 'y'.repeat(MAX_PATTERN_LENGTH + 1), 5, null]) {
      expect(parseSettings({ copy: { pattern } }).copy.pattern).toBe('yyyy-mm-dd');
    }
  });

  it('keeps a pattern exactly at the length limit, spaces included', () => {
    const pattern = ` ${'d'.repeat(MAX_PATTERN_LENGTH - 2)} `;
    expect(parseSettings({ copy: { pattern } }).copy.pattern).toBe(pattern);
  });

  it('defaults the time source to the server', () => {
    expect(parseSettings(undefined).time).toEqual({ source: 'server' });
  });

  it('keeps a valid time source and replaces an invalid one, independently of copy', () => {
    expect(parseSettings({ time: { source: 'device' } }).time.source).toBe('device');
    for (const source of ['ntp', 1, null, undefined]) {
      expect(parseSettings({ time: { source }, copy: { digits: 'persian' } })).toEqual({
        ...DEFAULT_SETTINGS, copy: { ...DEFAULT_SETTINGS.copy, digits: 'persian' },
      });
    }
    for (const time of ['device', [], 3]) {
      expect(parseSettings({ time }).time.source).toBe('server');
    }
  });

  it('ignores unknown keys', () => {
    expect(parseSettings({ copy: {}, extra: 1 })).toEqual(DEFAULT_SETTINGS);
  });
});
