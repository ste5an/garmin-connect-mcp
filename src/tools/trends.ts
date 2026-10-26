import { z } from 'zod';
import { type DateRange, rangeFields, resolveRange } from './dates';
import { defineTool } from './define';
import { compact, kgFromGrams, round, stats } from './format';
import { LegacyLoginRequiredError } from '../garmin/legacy-auth';
import { latestReadiness, summarizeDay, summarizeSleep } from './summaries';
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

function requireLegacyLogin(client: GarminClient): void {
  if (!client.hasLegacyLogin) throw new LegacyLoginRequiredError();
}

async function dailyRows(client: GarminClient, range: DateRange): Promise<Raw[]> {
  const summaries = (await client.getDailySummaries(range.from, range.to)) as Raw;
  return (summaries?.data ?? []).map((entry: Raw) => summarizeDay(entry)).filter((day: Raw | null) => day !== null);
}

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
    rows: (await client.getSleepSummaries(range.from, range.to)).map((night) => ({
      date: (night as Raw).calendarDate,
      value: summarizeSleep(night as Raw)?.score,
    })),
  }),
  sleep_hours: async (client, range) => ({
    unit: 'hours',
    rows: (await client.getSleepSummaries(range.from, range.to)).map((night) => ({
      date: (night as Raw).calendarDate,
      value: round((summarizeSleep(night as Raw)?.minutes?.total ?? NaN) / 60, 2),
    })),
  }),
  hrv: async (client, range) => ({
    unit: 'ms (overnight average)',
    rows: (((await client.getHrvSummaries(range.from, range.to)) as Raw)?.hrvSummaries ?? []).map((night: Raw) => ({
      date: night.calendarDate,
      value: night.lastNightAvg,
      status: night.status?.toLowerCase(),
    })),
  }),
  resting_hr: async (client, range) => ({
    unit: 'bpm',
    rows: (await dailyRows(client, range)).map((day) => ({ date: day.date, value: day.heartRate?.resting })),
  }),
  stress: async (client, range) => ({
    unit: 'average stress (0-100)',
    rows: (await dailyRows(client, range)).map((day) => ({ date: day.date, value: day.stress?.avg, max: day.stress?.max })),
  }),
  body_battery: async (client, range) => ({
    unit: 'points charged',
    rows: ((await client.getBodyBattery(range.from, range.to)) as Raw[]).map((day) => ({
      date: day.date,
      value: day.charged,
      drained: day.drained,
    })),
  }),
  readiness: async (client, range) => {
    requireLegacyLogin(client);
    return {
      unit: 'score',
      rows: (await client.getTrainingReadinessRange(range.from, range.to)).map(({ date, data }) => {
        const entry = latestReadiness(data);
        return { date, value: entry?.score, level: entry?.level?.toLowerCase() };
      }),
    };
  },
  spo2: async (client, range) => ({
    unit: '%',
    rows: (await dailyRows(client, range)).map((day) => ({ date: day.date, value: day.spo2?.avg, lowest: day.spo2?.lowest })),
  }),
  respiration: async (client, range) => ({
    unit: 'breaths/min',
    rows: (await dailyRows(client, range)).map((day) => ({ date: day.date, value: day.respiration?.avg })),
  }),
  vo2max: async (client, range) => {
    requireLegacyLogin(client);
    return {
      unit: 'ml/kg/min',
      rows: (await client.getVO2MaxRange(range.from, range.to)).map(({ date, data }) => ({
        date,
        value: (data as Raw[] | null)?.[0]?.generic?.vo2MaxPreciseValue,
      })),
    };
  },
  weight: async (client, range) => ({
    unit: 'kg',
    rows: (((await client.getWeightMeasurements(range.from, range.to)) as Raw)?.dailyWeightSummaries ?? []).map((day: Raw) => ({
      date: day.summaryDate,
      value: kgFromGrams(day.latestWeight?.weight),
      bodyFatPercent: round(day.latestWeight?.bodyFat, 1),
    })),
  }),
  intensity_minutes: async (client, range) => ({
    unit: 'minutes per day (vigorous counts double)',
    rows: (await dailyRows(client, range)).map((day) => ({
      date: day.date,
      value: (day.intensityMinutes?.moderate ?? 0) + 2 * (day.intensityMinutes?.vigorous ?? 0),
      goal: day.intensityMinutes?.goal,
    })),
  }),
};

export const trends = defineTool({
  name: 'trends',
  title: 'Metric trends',
  description:
    'Daily series for one metric over a period, with min/max/average/latest: steps, sleep score, sleep hours, HRV, resting HR, stress, ' +
    'Body Battery, SpO2, respiration, weight or intensity minutes; readiness and VO2 max need the optional email login. Defaults to the last 14 days.',
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
