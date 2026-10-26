import { describe, expect, it } from 'vitest';
import { LegacyLoginRequiredError } from '../garmin/legacy-auth';
import { training } from './training';

describe('training', () => {
  it('asks for the optional email login when it is not set up', async () => {
    const client = { hasLegacyLogin: false } as any;
    await expect(training.run({}, { client })).rejects.toBeInstanceOf(LegacyLoginRequiredError);
  });
});
