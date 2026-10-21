import { describe, expect, it } from 'vitest';
import { AuthRequiredError } from './garmin/auth';
import { describeError, isWriteEnabled, selectTools } from './server';
import { tools } from './tools';

describe('tool catalog', () => {
  it('has unique names and descriptions an assistant can act on', () => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) expect(tool.description.length).toBeGreaterThan(20);
  });

  it('marks every destructive tool as needing confirmation', () => {
    for (const tool of tools.filter((item) => item.mode === 'destructive')) {
      expect(Object.keys(tool.input)).toContain('confirm');
    }
  });
});

describe('write gate', () => {
  it('hides write and destructive tools unless GARMIN_ENABLE_WRITE=1', () => {
    expect(selectTools(false).every((tool) => (tool.mode ?? 'read') === 'read')).toBe(true);
    expect(selectTools(true).length).toBeGreaterThan(selectTools(false).length);
  });

  it('enables writes only for the exact value 1', () => {
    expect(isWriteEnabled({ GARMIN_ENABLE_WRITE: '1' })).toBe(true);
    expect(isWriteEnabled({ GARMIN_ENABLE_WRITE: 'true' })).toBe(false);
    expect(isWriteEnabled({})).toBe(false);
  });
});

describe('describeError', () => {
  it('tells the user how to log in', () => {
    expect(describeError(new AuthRequiredError())).toContain('garmin-connect-mcp login');
  });

  it('falls back to the error message', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});
