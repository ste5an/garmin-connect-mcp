import { describe, expect, it, vi } from 'vitest';
import { LegacyLoginRequiredError } from '../garmin/legacy-auth';
import { createRunWorkout, deleteWorkout } from './workout';

const steps = [
  { type: 'warmup' as const, seconds: 600 },
  { repeat: 6, steps: [{ type: 'work' as const, seconds: 180, fastPace: '4:20', slowPace: '4:30' }, { type: 'recovery' as const, seconds: 120 }] },
  { type: 'cooldown' as const, seconds: 600 },
];

function fakeClient(overrides: Record<string, unknown> = {}) {
  return {
    hasLegacyLogin: true,
    createWorkout: vi.fn().mockResolvedValue({ workoutId: 987 }),
    scheduleWorkout: vi.fn().mockResolvedValue({}),
    deleteWorkout: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  } as any;
}

describe('create_run_workout', () => {
  it('returns the payload on a dry run without calling Garmin or needing the login', async () => {
    const client = fakeClient({ hasLegacyLogin: false });
    const result = (await createRunWorkout.run({ name: 'VO2', steps, dryRun: true }, { client })) as any;
    expect(result.dryRun).toBe(true);
    expect(result.summary).toHaveLength(3);
    expect(result.workout.workoutSegments[0].workoutSteps).toHaveLength(3);
    expect(client.createWorkout).not.toHaveBeenCalled();
  });

  it('asks for the optional email login when it is not set up', async () => {
    const client = fakeClient({ hasLegacyLogin: false });
    await expect(createRunWorkout.run({ name: 'VO2', steps }, { client })).rejects.toBeInstanceOf(LegacyLoginRequiredError);
  });

  it('creates the workout and schedules it on the date', async () => {
    const client = fakeClient();
    const result = (await createRunWorkout.run({ name: 'VO2', steps, date: '2026-10-30' }, { client })) as any;
    expect(client.createWorkout).toHaveBeenCalledOnce();
    expect(client.scheduleWorkout).toHaveBeenCalledWith(987, '2026-10-30');
    expect(result).toMatchObject({ workoutId: 987, scheduledFor: '2026-10-30' });
  });

  it('only saves to the library when no date is given', async () => {
    const client = fakeClient();
    await createRunWorkout.run({ name: 'VO2', steps }, { client });
    expect(client.scheduleWorkout).not.toHaveBeenCalled();
  });

  it('refuses to schedule when Garmin returns no workoutId', async () => {
    const client = fakeClient({ createWorkout: vi.fn().mockResolvedValue({}) });
    await expect(createRunWorkout.run({ name: 'VO2', steps, date: '2026-10-30' }, { client })).rejects.toThrow('workoutId');
    expect(client.scheduleWorkout).not.toHaveBeenCalled();
  });

  it('rejects an invalid step before calling Garmin', async () => {
    const client = fakeClient();
    await expect(createRunWorkout.run({ name: 'bad', steps: [{ type: 'work' }] }, { client })).rejects.toThrow('exactly one');
    expect(client.createWorkout).not.toHaveBeenCalled();
  });
});

describe('delete_workout', () => {
  it('asks for the optional email login when it is not set up', async () => {
    const client = fakeClient({ hasLegacyLogin: false });
    await expect(deleteWorkout.run({ workoutId: 1 }, { client })).rejects.toBeInstanceOf(LegacyLoginRequiredError);
  });

  it('deletes by id', async () => {
    const client = fakeClient();
    expect(await deleteWorkout.run({ workoutId: 987 }, { client })).toEqual({ deleted: 987 });
    expect(client.deleteWorkout).toHaveBeenCalledWith(987);
  });
});
