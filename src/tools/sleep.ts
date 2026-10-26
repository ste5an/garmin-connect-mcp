import { z } from 'zod';
import { rangeFields, resolveDate, resolveRange } from './dates';
import { defineTool } from './define';
import { compact, round, stats } from './format';
import { summarizeSleep } from './summaries';

export const sleep = defineTool({
  name: 'sleep',
  title: 'Sleep',
  description:
    'Sleep analysis: score, duration, stages with ratings, bedtime, SpO2, respiration, sleep need. ' +
    'Pass `date` for one night (the morning you woke up) or `days`/`from`/`to` for several nights with averages.',
  input: {
    date: z.string().optional().describe('Single night: YYYY-MM-DD, "today" (last night) or "yesterday". Ignored when a range is given.'),
    ...rangeFields,
  },
  run: async ({ date, from, to, days }, { client }) => {
    const isRange = from !== undefined || (days !== undefined && days > 1);
    if (!isRange) {
      return summarizeSleep((await client.getSleep(resolveDate(date ?? to))) as any) ?? { message: 'No sleep recorded for that date.' };
    }
    const range = resolveRange({ from, to, days }, 7);
    const results = await client.getSleepSummaries(range.from, range.to);
    const nights = results.map((entry) => summarizeSleep(entry as any)).filter((night) => night !== null);
    return compact({
      from: range.from,
      to: range.to,
      average: {
        score: stats(nights.map((night) => night.score))?.avg,
        totalMinutes: round(stats(nights.map((night) => night.minutes?.total))?.avg),
      },
      nights,
    });
  },
});
