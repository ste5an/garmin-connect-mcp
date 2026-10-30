import { activities, activity } from './activities';
import { body } from './body';
import { dailyBriefing } from './briefing';
import type { ToolDefinition } from './define';
import { coachPlan } from './plan';
import { profile } from './profile';
import { garminApi } from './raw';
import { recovery } from './recovery';
import { sleep } from './sleep';
import { training } from './training';
import { trends } from './trends';
import { weeklySummary } from './weekly';
import { createRunWorkout, deleteWorkout } from './workout';

export const tools: ToolDefinition<any>[] = [
  dailyBriefing,
  sleep,
  recovery,
  activities,
  activity,
  training,
  coachPlan,
  trends,
  weeklySummary,
  body,
  profile,
  garminApi,
  createRunWorkout,
  deleteWorkout,
];
