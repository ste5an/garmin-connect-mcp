import { z } from 'zod';
import { LegacyLoginRequiredError } from '../garmin/legacy-auth';
import { resolveDate } from './dates';
import { defineTool } from './define';
import { compact } from './format';
import { buildRunWorkout, describeRunWorkout, runWorkoutStepsSchema } from './workout-builder';

type Raw = Record<string, any>;

export const createRunWorkout = defineTool({
  name: 'create_run_workout',
  title: 'Create a run workout',
  description:
    'Create a structured running workout in Garmin Connect (warm-up, work and recovery steps, repeats, pace targets) and optionally schedule it on a date so it syncs to the watch. ' +
    'Needs the optional email login. Use dryRun to check the payload first. Check the workout in Garmin Connect before running it.',
  input: {
    name: z.string().min(1).max(80).describe('Workout name shown on the watch.'),
    steps: runWorkoutStepsSchema.describe('Steps in order. A repeat group holds the steps that loop.'),
    date: z.string().optional().describe('Schedule on this day: YYYY-MM-DD, "today" or "tomorrow". Omit to only save it in the workout library.'),
    dryRun: z.boolean().optional().describe('Build and return the workout without sending it to Garmin.'),
  },
  writes: true,
  run: async ({ name, steps, date, dryRun }, { client }) => {
    const workout = buildRunWorkout(name, steps);
    const summary = describeRunWorkout(steps);
    const scheduledFor = date ? resolveDate(date) : undefined;
    if (dryRun) return { dryRun: true, name, scheduledFor, summary, workout };

    if (!client.hasLegacyLogin) throw new LegacyLoginRequiredError();
    const created = (await client.createWorkout(workout)) as Raw;
    const workoutId = created?.workoutId;
    if (!workoutId) throw new Error('Garmin accepted the workout but returned no workoutId. Check Garmin Connect before retrying to avoid a duplicate.');
    if (scheduledFor) await client.scheduleWorkout(workoutId, scheduledFor);
    return compact({
      workoutId,
      name,
      scheduledFor,
      summary,
      next: 'Open the workout in Garmin Connect to check the steps, then sync the watch.',
    });
  },
});

export const deleteWorkout = defineTool({
  name: 'delete_workout',
  title: 'Delete a saved workout',
  description:
    'Delete a saved workout from the Garmin Connect library by workoutId, for example one made by create_run_workout. Needs the optional email login.',
  input: {
    workoutId: z.union([z.number().int().positive(), z.string().regex(/^\d+$/)]).describe('Id returned by create_run_workout.'),
  },
  writes: true,
  destructive: true,
  run: async ({ workoutId }, { client }) => {
    if (!client.hasLegacyLogin) throw new LegacyLoginRequiredError();
    await client.deleteWorkout(workoutId);
    return { deleted: workoutId };
  },
});
