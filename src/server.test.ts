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

  it('exposes no tool that writes to Garmin', () => {
    expect(tools.map((tool) => tool.name).filter((name) => /^(log|delete|rename|assign)_/.test(name))).toEqual([]);
  });
});

describe('describeError', () => {
  it('tells the user how to set up the key', () => {
    const message = describeError(new AuthRequiredError('No Garmin Personal API key found.'));
    expect(message).toContain('No Garmin Personal API key found.');
    expect(message).toContain('garmin-connect-mcp setup');
  });

  it('falls back to the error message', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});
