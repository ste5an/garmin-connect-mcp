import { describe, expect, it } from 'vitest';
import { addDays, formatDate, resolveDate, resolveRange } from './dates';

describe('resolveDate', () => {
  it('defaults to today in local time', () => {
    expect(resolveDate()).toBe(formatDate(new Date()));
    expect(resolveDate('Today')).toBe(formatDate(new Date()));
  });

  it('accepts explicit dates', () => {
    expect(resolveDate('2026-10-21')).toBe('2026-10-21');
  });

  it('rejects malformed and impossible dates', () => {
    expect(() => resolveDate('21/10/2026')).toThrow('Invalid date');
    expect(() => resolveDate('2026-02-31')).toThrow('Invalid date');
  });
});

describe('addDays', () => {
  it('crosses month and year boundaries', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });
});

describe('resolveRange', () => {
  it('builds an inclusive range ending at `to`', () => {
    const range = resolveRange({ to: '2026-10-21', days: 3 }, 7);
    expect(range.dates).toEqual(['2026-10-19', '2026-10-20', '2026-10-21']);
  });

  it('uses the default length', () => {
    expect(resolveRange({ to: '2026-10-21' }, 7).dates).toHaveLength(7);
  });

  it('rejects inverted and oversized ranges', () => {
    expect(() => resolveRange({ from: '2026-10-21', to: '2026-10-01' }, 7)).toThrow('must not be after');
    expect(() => resolveRange({ from: '2025-01-01', to: '2026-10-01' }, 7)).toThrow('maximum');
  });
});
