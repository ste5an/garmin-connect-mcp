import { describe, expect, it } from 'vitest';
import { AuthRequiredError } from './garmin/auth';
import { LegacyLoginRequiredError } from './garmin/legacy-auth';
import { describeError } from './server';
import { tools } from './tools';

describe('tool catalog', () => {
  it('has unique names and descriptions an assistant can act on', () => {
    const names = tools.map((tool) => tool.name);
    expect(new Set(names).size).toBe(names.length);
    for (const tool of tools) expect(tool.description.length).toBeGreaterThan(20);
  });

  it('limits writes to the run workout tools', () => {
    expect(tools.filter((tool) => tool.writes).map((tool) => tool.name)).toEqual(['create_run_workout', 'delete_workout']);
    expect(tools.filter((tool) => tool.destructive).map((tool) => tool.name)).toEqual(['delete_workout']);
  });
});

describe('describeError', () => {
  it('tells the user how to set up the key', () => {
    const message = describeError(new AuthRequiredError('No Garmin Personal API key found.'));
    expect(message).toContain('No Garmin Personal API key found.');
    expect(message).toContain('garmin-connect-mcp setup');
  });

  it('tells the user how to unlock the Coach plan', () => {
    expect(describeError(new LegacyLoginRequiredError())).toContain('garmin-connect-mcp login');
  });

  it('falls back to the error message', () => {
    expect(describeError(new Error('boom'))).toBe('boom');
  });
});
