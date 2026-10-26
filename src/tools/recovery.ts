import { z } from 'zod';
import { rangeFields, resolveDate, resolveRange } from './dates';
import { defineTool, gather } from './define';
import { compact } from './format';
import { latestReadiness, summarizeDay, summarizeHrv, summarizeReadiness, summarizeSleep } from './summaries';

type Raw = Record<string, any>;

export const recovery = defineTool({
  name: 'recovery',
  title: 'Recovery',
  description:
    'Recovery signals: HRV status against the balanced range, resting HR, Body Battery, stress and sleep score, plus training readiness ' +
    '(score, level, contributing factors, recovery hours) when the optional email login is set up. ' +
    'Use it to decide whether to train hard, go easy or rest. Pass `days`/`from`/`to` for a trend.',
  input: {
    date: z.string().optional().describe('Single day: YYYY-MM-DD, "today" or "yesterday". Ignored when a range is given.'),
    ...rangeFields,
  },
  run: async ({ date, from, to, days }, { client }) => {
    const isRange = from !== undefined || (days !== undefined && days > 1);
    if (isRange) {
      const range = resolveRange({ from, to, days }, 7);
      const [summaries, hrv, readiness] = await Promise.all([
        client.getDailySummaries(range.from, range.to) as Promise<Raw>,
        client.getHrvSummaries(range.from, range.to) as Promise<Raw>,
        client.hasLegacyLogin ? client.getTrainingReadinessRange(range.from, range.to) : Promise.resolve([]),
      ]);
      const readinessByDate = new Map(readiness.map((entry) => [entry.date, latestReadiness(entry.data)]));
      const hrvByDate = new Map<string, Raw>((hrv.hrvSummaries ?? []).map((entry: Raw) => [entry.calendarDate, entry]));
      return {
        from: range.from,
        to: range.to,
        days: ((summaries.data ?? []) as Raw[]).map((entry) => {
          const day = summarizeDay(entry);
          const night = hrvByDate.get(entry.calendarDate);
          const ready = readinessByDate.get(entry.calendarDate);
          return compact({
            date: entry.calendarDate,
            readiness: ready?.score,
            readinessLevel: ready?.level?.toLowerCase(),
            restingHr: day?.heartRate?.resting,
            avgStress: day?.stress?.avg,
            bodyBatteryHigh: day?.bodyBattery?.high,
            hrvLastNight: night?.lastNightAvg,
            hrvStatus: summarizeHrv({ hrvSummary: night })?.status,
          });
        }),
      };
    }
    const day = resolveDate(date);
    const { data, unavailable } = await gather({
      readiness: () => (client.hasLegacyLogin ? client.getTrainingReadiness(day) : Promise.resolve(undefined)),
      hrv: () => client.getHrv(day),
      day: () => client.getDailySummaries(day, day),
      sleep: () => client.getSleep(day),
    });
    const summary = summarizeDay(((data.day as Raw | undefined)?.data ?? [])[0]);
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
