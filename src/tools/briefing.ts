import { addDays, dateField, resolveDate } from './dates';
import { defineTool, gather } from './define';
import { compact } from './format';
import { loadCoachWorkouts } from './plan';
import { summarizeActivity, summarizeDay, summarizeHrv, summarizeSleep } from './summaries';

export const dailyBriefing = defineTool({
  name: 'daily_briefing',
  title: 'Daily briefing',
  description:
    'One-call overview of a day: steps, calories, heart rate, stress, Body Battery, hydration, last night\'s sleep, HRV, the workouts done and, when the optional email login is set up, the Garmin Coach workouts planned. ' +
    'Start here for questions like "how am I doing today".',
  input: { date: dateField },
  run: async ({ date }, { client }) => {
    const day = resolveDate(date);
    const { data, unavailable } = await gather({
      day: () => client.getDailySummaries(day, day),
      sleep: () => client.getSleep(day),
      hrv: () => client.getHrv(day),
      activities: () => client.getActivitiesByDate(day, day),
      coach: () => (client.hasLegacyLogin ? loadCoachWorkouts(client, day, addDays(day, 1)) : Promise.resolve(undefined)),
    });
    return compact({
      date: day,
      day: summarizeDay(((data.day as Record<string, any> | undefined)?.data ?? [])[0]),
      sleep: summarizeSleep(data.sleep as any),
      hrv: summarizeHrv(data.hrv as any),
      workoutsDone: ((data.activities as any[]) ?? []).map(summarizeActivity),
      coachPlan: data.coach,
      unavailable,
    });
  },
});
