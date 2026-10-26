import { activities, activity } from './activities';
import { body } from './body';
import { dailyBriefing } from './briefing';
import type { ToolDefinition } from './define';
import { profile } from './profile';
import { garminApi } from './raw';
import { recovery } from './recovery';
import { sleep } from './sleep';
import { trends } from './trends';
import { weeklySummary } from './weekly';

export const tools: ToolDefinition<any>[] = [
  dailyBriefing,
  sleep,
  recovery,
  activities,
  activity,
  trends,
  weeklySummary,
  body,
  profile,
  garminApi,
];
