import { z } from 'zod';
import { addDays, resolveDate } from './dates';
import { defineTool } from './define';
import { clock, compact, km, round } from './format';

type Raw = Record<string, any>;

const RUN_TYPES = new Set(['running', 'trail_running', 'treadmill_running', 'track_running', 'virtual_run']);
const STRENGTH_TYPES = new Set(['strength_training']);

export function weekStart(date: string): string {
  const weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
  return addDays(date, -((weekday + 6) % 7));
}

export function summarizeWeeks(activities: Raw[], firstWeek: string, weekCount: number) {
  const weeks = Array.from({ length: weekCount }, (_, index) => {
    const start = addDays(firstWeek, index * 7);
    const end = addDays(start, 6);
    const inWeek = activities.filter((activity) => {
      const day = String(activity.startTimeLocal ?? '').slice(0, 10);
      return day >= start && day <= end;
    });
    const runs = inWeek.filter((activity) => RUN_TYPES.has(activity.activityType?.typeKey));
    const strength = inWeek.filter((activity) => STRENGTH_TYPES.has(activity.activityType?.typeKey));
    const runMeters = runs.reduce((sum, run) => sum + (run.distance ?? 0), 0);
    const runSeconds = runs.reduce((sum, run) => sum + (run.duration ?? 0), 0);
    const longest = runs.reduce((max, run) => Math.max(max, run.distance ?? 0), 0);
    const load = inWeek.reduce((sum, activity) => sum + (activity.activityTrainingLoad ?? 0), 0);
    const totalSeconds = inWeek.reduce((sum, activity) => sum + (activity.duration ?? 0), 0);
    return compact({
      weekStart: start,
      weekEnd: end,
      sessions: inWeek.length,
      runs: runs.length,
      runKm: km(runMeters, 1),
      runTime: runs.length ? clock(runSeconds) : undefined,
      longestRunKm: km(longest, 1),
      longestRunShare: runMeters > 0 ? round(longest / runMeters, 2) : undefined,
      strengthSessions: strength.length,
      otherSessions: inWeek.length - runs.length - strength.length,
      totalTime: inWeek.length ? clock(totalSeconds) : undefined,
      trainingLoad: round(load),
    });
  });
  return weeks.map((week, index) => {
    const previous = weeks[index - 1];
    const change =
      previous?.runKm && week.runKm !== undefined ? round(((week.runKm - previous.runKm) / previous.runKm) * 100) : undefined;
    return compact({ ...week, runKmChangePercent: change });
  });
}

export const weeklySummary = defineTool({
  name: 'weekly_summary',
  title: 'Weekly training summary',
  description:
    'Training totals per week (Monday to Sunday): run count, run kilometres, longest run and its share of the week, strength sessions, total time, training load and the run distance change versus the previous week. Defaults to the last 4 weeks including the current one.',
  input: {
    weeks: z.number().int().min(1).max(12).optional().describe('How many weeks to show, ending with the week of `date`. Default 4.'),
    date: z.string().optional().describe('A date inside the last week to show: YYYY-MM-DD, today or yesterday. Default today.'),
  },
  run: async ({ weeks, date }, { client }) => {
    const count = weeks ?? 4;
    const lastWeek = weekStart(resolveDate(date));
    const firstWeek = addDays(lastWeek, -(count - 1) * 7);
    const activities = (await client.getActivitiesByDate(firstWeek, addDays(lastWeek, 6))) as Raw[];
    return { weeks: summarizeWeeks(Array.isArray(activities) ? activities : [], firstWeek, count) };
  },
});
