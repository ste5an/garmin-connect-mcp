import { describe, expect, it } from 'vitest';
import { REDACTED, isRedactionEnabled, redactPersonalFields } from './redact';

describe('redactPersonalFields', () => {
  it('masks personal keys at any depth and keeps metrics', () => {
    const result = redactPersonalFields({
      displayName: 'abc-123',
      fullName: 'Jane Doe',
      steps: 9000,
      devices: [{ serialNumber: 'X1', model: 'Forerunner' }],
      activity: { startLatitude: 26.7, startLongitude: -80.1, distance: 5000 },
    });
    expect(result).toEqual({
      displayName: REDACTED,
      fullName: REDACTED,
      steps: 9000,
      devices: [{ serialNumber: REDACTED, model: 'Forerunner' }],
      activity: { startLatitude: REDACTED, startLongitude: REDACTED, distance: 5000 },
    });
  });

  it('leaves null values and primitives alone', () => {
    expect(redactPersonalFields({ email: null })).toEqual({ email: null });
    expect(redactPersonalFields(5)).toBe(5);
  });
});

describe('isRedactionEnabled', () => {
  it('is on unless explicitly disabled', () => {
    expect(isRedactionEnabled({})).toBe(true);
    expect(isRedactionEnabled({ GARMIN_RAW_UNREDACTED: '1' })).toBe(false);
  });
});
