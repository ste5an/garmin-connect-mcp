import { z } from 'zod';
import { type DateRange, rangeFields, resolveRange } from './dates';
import { defineTool, mapConcurrent } from './define';
import { compact, kgFromGrams, round, stats } from './format';
import { latestReadiness, summarizeHrv, summarizeSleep } from './summaries';
import type { GarminClient } from '../garmin/client';

type Raw = Record<string, any>;
type Row = { date: string; value?: number; [key: string]: unknown };
type Series = { unit: string; rows: Row[] };

const METRICS = [
  'steps',
  'sleep_score',
  'sleep_hours',
  'hrv',
  'resting_hr',
  'stress',
  'body_battery',
  'readiness',
  'spo2',
  'respiration',
  'vo2max',
  'weight',
  'intensity_minutes',
] as const;

type Metric = (typeof METRICS)[number];

const RESTING_HR_CONCURRENCY = 4;

const loaders: Record<Metric, (client: GarminClient, range: DateRange) => Promise<Series>> = {
  steps: async (client, range) => ({
    unit: 'steps',
    rows: ((await client.getDailySteps(range.from, range.to)) as Raw[]).map((day) => ({
      date: day.calendarDate,
      value: day.totalSteps,
      goal: day.stepGoal,
    })),
  }),
  sleep_score: async (client, range) => ({
    unit: 'score',
    rows: (await client.getSleepDataRange(range.from, range.to)).map(({ date, data }) => ({
      date,
      value: summarizeSleep(data as Raw)?.score,
    })),
  }),
  sleep_hours: async (client, range) => ({
    unit: 'hours',
    rows: (await client.getSleepDataRange(range.from, range.to)).map(({ date, data }) => ({
      date,
      value: round((summarizeSleep(data as Raw)?.minutes?.total ?? NaN) / 60, 2),
    })),
  }),
  hrv: async (client, range) => ({
    unit: 'ms (overnight average)',
    rows: (await client.getHRVRange(range.from, range.to)).map(({ date, data }) => {
      const summary = summarizeHrv(data as Raw);
      return { date, value: summary?.lastNight, status: summary?.status };
    }),
  }),
  resting_hr: async (client, range) => ({
    unit: 'bpm',
    rows: await mapConcurrent(range.dates, RESTING_HR_CONCURRENCY, async (date) => {
      const raw = (await client.getRestingHeartRate(date).catch(() => null)) as Raw | null;
      return { date, value: raw?.allMetrics?.metricsMap?.WELLNESS_RESTING_HEART_RATE?.[0]?.value as number | undefined };
    }),
  }),
  stress: async (client, range) => ({
    unit: 'average stress (0-100)',
    rows: (await client.getStressRange(range.from, range.to)).map(({ date, data }) => ({
      date,
      value: (data as Raw | null)?.avgStressLevel,
      max: (data as Raw | null)?.maxStressLevel,
    })),
  }),
  body_battery: async (client, range) => ({
    unit: 'points charged',
    rows: ((await client.getBodyBattery(range.from, range.to)) as Raw[]).map((day) => ({
      date: day.date,
      value: day.charged,
      drained: day.drained,
    })),
  }),
  readiness: async (client, range) => ({
    unit: 'score',
    rows: (await client.getTrainingReadinessRange(range.from, range.to)).map(({ date, data }) => {
      const entry = latestReadiness(data);
      return { date, value: entry?.score, level: entry?.level?.toLowerCase() };
    }),
  }),
  spo2: async (client, range) => ({
    unit: '%',
    rows: (await client.getSpO2Range(range.from, range.to)).map(({ date, data }) => ({
      date,
      value: (data as Raw | null)?.averageSpO2,
      lowest: (data as Raw | null)?.lowestSpO2,
    })),
  }),
  respiration: async (client, range) => ({
    unit: 'breaths/min',
    rows: (await client.getRespirationRange(range.from, range.to)).map(({ date, data }) => ({
      date,
      value: (data as Raw | null)?.avgWakingRespirationValue,
      sleep: (data as Raw | null)?.avgSleepRespirationValue,
    })),
  }),
  vo2max: async (client, range) => ({
    unit: 'ml/kg/min',
    rows: (await client.getVO2MaxRange(range.from, range.to)).map(({ date, data }) => ({
      date,
      value: (data as Raw[] | null)?.[0]?.generic?.vo2MaxPreciseValue,
    })),
  }),
  weight: async (client, range) => ({
    unit: 'kg',
    rows: (((await client.getWeighIns(range.from, range.to)) as Raw)?.dailyWeightSummaries ?? []).map((day: Raw) => ({
      date: day.summaryDate,
      value: kgFromGrams(day.latestWeight?.weight),
      bodyFatPercent: round(day.latestWeight?.bodyFat, 1),
    })),
  }),
  intensity_minutes: async (client, range) => ({
    unit: 'minutes per week (vigorous counts double)',
    rows: ((await client.getWeeklyIntensityMinutes(range.from, range.to)) as Raw[]).map((week) => ({
      date: week.calendarDate,
      value: week.moderateValue + 2 * week.vigorousValue,
      goal: week.weeklyGoal,
    })),
  }),
};

export const trends = defineTool({
  name: 'trends',
  title: 'Metric trends',
  description:
    'Daily series for one metric over a period, with min/max/average/latest: steps, sleep score, sleep hours, HRV, resting HR, stress, ' +
    'Body Battery, readiness, SpO2, respiration, VO2 max, weight or weekly intensity minutes. Defaults to the last 14 days.',
  input: {
    metric: z.enum(METRICS).describe('Which metric to chart.'),
    ...rangeFields,
  },
  run: async ({ metric, from, to, days }, { client }) => {
    const range = resolveRange({ from, to, days }, 14);
    const series = await loaders[metric](client, range);
    const rows = series.rows.map((row) => compact(row));
    return {
      metric,
      unit: series.unit,
      from: range.from,
      to: range.to,
      summary: stats(series.rows.map((row) => row.value)),
      rows,
    };
  },
});
