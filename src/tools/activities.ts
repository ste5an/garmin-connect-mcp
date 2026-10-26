import { z } from 'zod';
import { resolveDate } from './dates';
import { defineTool, gather } from './define';
import { compact } from './format';
import { summarizeActivity, summarizeActivityDetail } from './summaries';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;

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
    'One activity by id (ids come from `activities`): summary metrics, running dynamics, training effect and the structured workout it followed, if any.',
  input: {
    id: z.number().int().describe('Activity id.'),
  },
  run: async ({ id }, { client }) => {
    const { data, unavailable } = await gather({
      summary: () => client.getActivity(id),
      workouts: () => client.getActivityWorkouts(id),
    });
    if (!data.summary) throw new Error(`Activity ${id} not found.`);
    return compact({
      ...summarizeActivityDetail(data.summary as any),
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
