import { z } from 'zod';
import { rangeFields, resolveDate, resolveRange } from './dates';
import { defineTool, gather } from './define';
import { compact } from './format';
import { latestReadiness, summarizeDay, summarizeHrv, summarizeReadiness, summarizeSleep } from './summaries';

export const recovery = defineTool({
  name: 'recovery',
  title: 'Recovery and readiness',
  description:
    'Training readiness (score, level, contributing factors, recovery hours), HRV status, resting HR, Body Battery and stress. ' +
    'Use it to decide whether to train hard, go easy or rest. Pass `days`/`from`/`to` for a trend.',
  input: {
    date: z.string().optional().describe('Single day: YYYY-MM-DD, "today" or "yesterday". Ignored when a range is given.'),
    ...rangeFields,
  },
  run: async ({ date, from, to, days }, { client }) => {
    const isRange = from !== undefined || (days !== undefined && days > 1);
    if (isRange) {
      const range = resolveRange({ from, to, days }, 7);
      const [readiness, hrv] = await Promise.all([
        client.getTrainingReadinessRange(range.from, range.to),
        client.getHRVRange(range.from, range.to),
      ]);
      return {
        from: range.from,
        to: range.to,
        days: range.dates.map((day, index) => {
          const entry = latestReadiness(readiness[index]?.data);
          const summary = summarizeHrv(hrv[index]?.data as any);
          return compact({
            date: day,
            readiness: entry?.score,
            level: entry?.level?.toLowerCase(),
            sleepScore: entry?.sleepScore,
            hrvLastNight: summary?.lastNight,
            hrvStatus: summary?.status,
            recoveryHours: entry ? Math.round((entry.recoveryTime / 60) * 10) / 10 : undefined,
          });
        }),
      };
    }
    const day = resolveDate(date);
    const { data, unavailable } = await gather({
      readiness: () => client.getTrainingReadiness(day),
      hrv: () => client.getHRV(day),
      day: () => client.getDailySummary(day),
      sleep: () => client.getSleepData(day),
    });
    const summary = summarizeDay(data.day as any);
    return compact({
      date: day,
      readiness: summarizeReadiness(data.readiness),
      hrv: summarizeHrv(data.hrv as any),
      restingHr: summary?.heartRate?.resting,
      stress: summary?.stress,
      bodyBattery: summary?.bodyBattery,
      sleepScore: summarizeSleep(data.sleep as any)?.score,
      unavailable,
    });
  },
});
