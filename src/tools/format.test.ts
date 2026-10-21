import { describe, expect, it } from 'vitest';
import { clock, compact, hoursMinutes, kgFromGrams, label, pacePerKm, stats } from './format';

describe('format', () => {
  it('formats clock times', () => {
    expect(clock(2916)).toBe('48:36');
    expect(clock(6627)).toBe('1:50:27');
    expect(clock(null)).toBeUndefined();
  });

  it('formats durations', () => {
    expect(hoursMinutes(25020)).toBe('6h57m');
    expect(hoursMinutes(2340)).toBe('39m');
  });

  it('converts speed to pace', () => {
    expect(pacePerKm(2.9)).toBe('5:45');
    expect(pacePerKm(0)).toBeUndefined();
  });

  it('humanizes Garmin keys', () => {
    expect(label('PRODUCTIVE_3')).toBe('productive');
    expect(label('ANAEROBIC_SHORTAGE')).toBe('anaerobic shortage');
  });

  it('treats missing body measures as absent', () => {
    expect(kgFromGrams(69000)).toBe(69);
    expect(kgFromGrams(null)).toBeUndefined();
    expect(kgFromGrams(0)).toBeUndefined();
  });

  it('removes empty values deeply but keeps zeros and false', () => {
    expect(compact({ a: 0, b: null, c: { d: undefined, e: false }, f: [1, undefined], g: '' })).toEqual({
      a: 0,
      c: { e: false },
      f: [1],
    });
  });

  it('computes stats ignoring gaps', () => {
    expect(stats([4, undefined, 8])).toEqual({ min: 4, max: 8, avg: 6, latest: 8 });
    expect(stats([])).toBeUndefined();
  });
});
