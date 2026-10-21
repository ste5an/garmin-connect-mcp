import { activities, activity } from './activities';
import { body } from './body';
import { dailyBriefing } from './briefing';
import type { ToolDefinition } from './define';
import { assignGear, deleteActivity, logActivity, logBloodPressure, logHydration, logWeight, renameActivity } from './log';
import { coachPlan } from './plan';
import { profile } from './profile';
import { garminApi } from './raw';
import { recovery } from './recovery';
import { sleep } from './sleep';
import { training } from './training';
import { trends } from './trends';
import { workouts } from './workouts';

export const tools: ToolDefinition<any>[] = [
  dailyBriefing,
  sleep,
  recovery,
  activities,
  activity,
  training,
  coachPlan,
  trends,
  body,
  profile,
  workouts,
  logWeight,
  logHydration,
  logBloodPressure,
  logActivity,
  renameActivity,
  assignGear,
  deleteActivity,
  garminApi,
];
