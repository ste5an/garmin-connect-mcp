import { describe, expect, it } from 'vitest';
import { AuthRequiredError } from './garmin/auth';
import { describeError } from './server';
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

describe('describeError', () => {
  it('tells the user how to log in', () => {
    expect(describeError(new AuthRequiredError())).toContain('garmin-connect-mcp login');
  });

  it('falls back to the error message', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});
