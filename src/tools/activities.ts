import { z } from 'zod';
import { resolveDate } from './dates';
import { defineTool, gather } from './define';
import { clock, compact, round } from './format';
import { summarizeActivity, summarizeActivityDetail, summarizeLaps } from './summaries';

const DEFAULT_LIMIT = 10;
const MAX_LIMIT = 50;
const INCLUDE_OPTIONS = ['laps', 'hr_zones', 'weather', 'gear', 'sets'] as const;

export const activities = defineTool({
  name: 'activities',
  title: 'Activities',
  description:
    'List workouts (runs, rides, strength, ...) with distance, pace, heart rate, training effect and load. ' +
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
      : await client.getActivities(0, limit ?? DEFAULT_LIMIT, type);
    const list = (raw as any[]) ?? [];
    return { count: list.length, activities: list.map(summarizeActivity) };
  },
});

export const activity = defineTool({
  name: 'activity',
  title: 'Activity detail',
  description:
    'Deep dive into one activity by id (ids come from `activities`): summary metrics plus optional laps/splits, heart-rate zones, weather, gear and strength sets.',
  input: {
    id: z.number().int().describe('Activity id.'),
    include: z
      .array(z.enum(INCLUDE_OPTIONS))
      .optional()
      .describe('Extra sections. Default ["laps", "hr_zones"].'),
  },
  run: async ({ id, include }, { client }) => {
    const wanted = new Set(include ?? ['laps', 'hr_zones']);
    const { data, unavailable } = await gather({
      summary: () => client.getActivity(id),
      laps: () => (wanted.has('laps') ? client.getActivitySplits(id) : Promise.resolve(undefined)),
      zones: () => (wanted.has('hr_zones') ? client.getActivityHrZones(id) : Promise.resolve(undefined)),
      weather: () => (wanted.has('weather') ? client.getActivityWeather(id) : Promise.resolve(undefined)),
      gear: () => (wanted.has('gear') ? client.getActivityGear(id) : Promise.resolve(undefined)),
      sets: () => (wanted.has('sets') ? client.getActivityExerciseSets(id) : Promise.resolve(undefined)),
    });
    if (!data.summary) throw new Error(`Activity ${id} not found.`);
    const zones = (data.zones as any[] | undefined)?.map((zone) => ({
      zone: zone.zoneNumber,
      fromBpm: zone.zoneLowBoundary,
      time: clock(zone.secsInZone),
    }));
    const weather = data.weather as any;
    return compact({
      ...summarizeActivityDetail(data.summary as any),
      laps: data.laps ? summarizeLaps(data.laps as any) : undefined,
      hrZones: zones,
      weather: weather && {
        tempF: weather.temp,
        humidityPercent: weather.relativeHumidity,
        windMph: weather.windSpeed,
        condition: weather.weatherTypeDTO?.desc,
      },
      gear: (data.gear as any[] | undefined)?.map((item) => item.displayName ?? item.customMakeModel),
      sets: (data.sets as any)?.exerciseSets
        ?.filter((set: any) => set.setType === 'ACTIVE')
        .map((set: any) => ({
          exercise: set.exercises?.[0]?.name ?? set.exercises?.[0]?.category,
          reps: set.repetitionCount,
          weightKg: set.weight ? round(set.weight / 1000, 1) : undefined,
          time: clock(set.duration),
        })),
      unavailable,
    });
  },
});
