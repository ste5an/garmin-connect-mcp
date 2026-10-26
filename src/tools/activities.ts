import { z } from 'zod';
import { resolveDate } from './dates';
import { defineTool, gather } from './define';
import { compact } from './format';
import { detectIntervals, parsePoints, summarizeSplits } from './splits';
import { summarizeActivity, summarizeActivityDetail } from './summaries';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const INCLUDE_OPTIONS = ['splits', 'intervals'] as const;

export const activities = defineTool({
  name: 'activities',
  title: 'Activities',
  description:
    'List workouts (runs, rides, strength, ...) with distance, pace, heart rate, time in heart-rate zones, training effect and load. ' +
    'Without dates it returns the most recent ones. Use `from`/`to` for a period and `type` to filter, for example "running".',
  input: {
    from: z.string().optional().describe('Start date, YYYY-MM-DD.'),
    to: z.string().optional().describe('End date, YYYY-MM-DD or "today". Defaults to today when `from` is set.'),
    type: z.string().optional().describe('Activity type key such as running, cycling, strength_training, swimming, walking.'),
    limit: z.number().int().min(1).max(MAX_LIMIT).optional().describe(`Maximum results when no dates are given. Default ${DEFAULT_LIMIT}.`),
  },
  run: async ({ from, to, type, limit }, { client }) => {
    const raw = from
      ? await client.getActivitiesByDate(resolveDate(from), resolveDate(to), type)
      : await client.getActivities({ limit: limit ?? DEFAULT_LIMIT, activityType: type });
    const list = (raw as any[]) ?? [];
    return { count: list.length, activities: list.map(summarizeActivity) };
  },
});

export const activity = defineTool({
  name: 'activity',
  title: 'Activity detail',
  description:
    'One activity by id (ids come from `activities`): summary metrics, running dynamics, training effect, the structured workout it followed, ' +
    'per-km splits and detected intervals (work and recovery reps with pace and heart rate, found from pace changes because Garmin lap data is not available).',
  input: {
    id: z.number().int().describe('Activity id.'),
    include: z.array(z.enum(INCLUDE_OPTIONS)).optional().describe('Extra sections. Default ["splits", "intervals"].'),
  },
  run: async ({ id, include }, { client }) => {
    const wanted = new Set(include ?? INCLUDE_OPTIONS);
    const { data, unavailable } = await gather({
      summary: () => client.getActivity(id),
      workouts: () => client.getActivityWorkouts(id),
      details: () => (wanted.size ? client.getActivityDetails(id) : Promise.resolve(undefined)),
    });
    if (!data.summary) throw new Error(`Activity ${id} not found.`);
    const points = data.details ? parsePoints(data.details as any) : [];
    return compact({
      ...summarizeActivityDetail(data.summary as any),
      intervals: wanted.has('intervals') ? detectIntervals(points) : undefined,
      splits: wanted.has('splits') ? summarizeSplits(points) : undefined,
      workouts: ((data.workouts as any[] | undefined) ?? []).map((workout) => ({
        name: workout.workoutName,
        sport: workout.sport,
        description: workout.workoutPhrase,
        steps: workout.steps?.length,
      })),
      unavailable,
    });
  },
});
