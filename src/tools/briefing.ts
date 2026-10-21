import { addDays, dateField, resolveDate } from './dates';
import { defineTool, gather } from './define';
import { compact } from './format';
import { loadCoachWorkouts } from './plan';
import {
  summarizeActivity,
  summarizeDay,
  summarizeHrv,
  summarizeReadiness,
  summarizeSleep,
  summarizeTrainingStatus,
} from './summaries';

export const dailyBriefing = defineTool({
  name: 'daily_briefing',
  title: 'Daily briefing',
  description:
    'One-call overview of a day: steps, heart rate, stress, Body Battery, last night\'s sleep, training readiness, HRV, ' +
    'training status, workouts done and the coach workouts planned. Start here for questions like "how am I doing" or "what should I do today".',
  input: { date: dateField },
  run: async ({ date }, { client }) => {
    const day = resolveDate(date);
    const { data, unavailable } = await gather({
      day: () => client.getDailySummary(day),
      sleep: () => client.getSleepData(day),
      readiness: () => client.getTrainingReadiness(day),
      hrv: () => client.getHRV(day),
      training: () => client.getTrainingStatus(day),
      activities: () => client.getActivitiesByDate(day, day),
      coach: () => loadCoachWorkouts(client, day, addDays(day, 1)),
      hydration: () => client.getHydration(day),
    });
    const hydration = data.hydration as { valueInML?: number; goalInML?: number } | undefined;
    return compact({
      date: day,
      day: summarizeDay(data.day as any),
      sleep: summarizeSleep(data.sleep as any),
      readiness: summarizeReadiness(data.readiness),
      hrv: summarizeHrv(data.hrv as any),
      hydration: hydration && { ml: hydration.valueInML, goalMl: hydration.goalInML },
      training: summarizeTrainingStatus(data.training as any),
      workoutsDone: ((data.activities as any[]) ?? []).map(summarizeActivity),
      coachPlan: data.coach,
      unavailable,
    });
  },
});
