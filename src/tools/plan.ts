import { z } from 'zod';
import type { GarminClient } from '../garmin/client';
import { addDays, resolveDate } from './dates';
import { defineTool } from './define';
import { compact } from './format';
import { summarizeCoachTask } from './summaries';

type Raw = Record<string, any>;

const COACH_CATEGORY = 'FBT_ADAPTIVE';

export async function loadCoachPlan(client: GarminClient): Promise<{ meta: Raw; tasks: Raw[] } | null> {
  const list = (await client.getTrainingPlans()) as Raw;
  const plans: Raw[] = list?.trainingPlanList ?? [];
  const coach = plans.find((plan) => plan.trainingPlanCategory === COACH_CATEGORY);
  if (!coach) return null;
  const detail = (await client.getAdaptiveTrainingPlan(String(coach.trainingPlanId))) as Raw;
  return { meta: { ...coach, ...detail }, tasks: detail?.taskList ?? [] };
}

export async function loadCoachWorkouts(client: GarminClient, from: string, to: string) {
  const plan = await loadCoachPlan(client);
  if (!plan) return [];
  return plan.tasks
    .filter((task) => task.calendarDate >= from && task.calendarDate <= to)
    .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))
    .map(summarizeCoachTask);
}

export const coachPlan = defineTool({
  name: 'coach_plan',
  title: 'Garmin Coach plan',
  description:
    'Workouts prescribed by the Garmin Coach (adaptive) training plan, such as tomorrow\'s session with its interval structure. ' +
    'Defaults to the next 7 days. Garmin only exposes the current week of the plan.',
  input: {
    from: z.string().optional().describe('First day, YYYY-MM-DD or "today"/"tomorrow". Defaults to today.'),
    to: z.string().optional().describe('Last day. Defaults to 6 days after `from`.'),
  },
  run: async ({ from, to }, { client }) => {
    const start = resolveDate(from);
    const end = to ? resolveDate(to) : addDays(start, 6);
    const plan = await loadCoachPlan(client);
    if (!plan) return { message: 'No Garmin Coach plan found on this account.' };
    const phases: Raw[] = plan.meta.adaptivePlanPhases ?? [];
    const phase = phases.find((item) => item.currentPhase);
    return compact({
      plan: {
        name: plan.meta.name,
        startDate: plan.meta.startDate?.slice(0, 10),
        raceDate: plan.meta.endDate?.slice(0, 10),
        weeks: plan.meta.durationInWeeks,
        currentPhase: phase?.trainingPhase?.toLowerCase(),
        phaseEnds: phase?.endDate,
      },
      workouts: plan.tasks
        .filter((task) => task.calendarDate >= start && task.calendarDate <= end)
        .sort((a, b) => a.calendarDate.localeCompare(b.calendarDate))
        .map(summarizeCoachTask),
    });
  },
});
