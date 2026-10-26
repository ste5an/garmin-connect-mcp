import { rangeFields, resolveRange } from './dates';
import { defineTool } from './define';
import { compact, kgFromGrams, round } from './format';

type Raw = Record<string, any>;

export const body = defineTool({
  name: 'body',
  title: 'Weight and body composition',
  description: 'Weigh-ins (kg, body fat, muscle, BMI) for a period. Defaults to the last 30 days.',
  input: rangeFields,
  run: async ({ from, to, days }, { client }) => {
    const range = resolveRange({ from, to, days }, 30);
    const measurements = (await client.getWeightMeasurements(range.from, range.to)) as Raw;
    const summaries: Raw[] = measurements?.dailyWeightSummaries ?? [];
    return compact({
      from: range.from,
      to: range.to,
      averageKg: kgFromGrams(measurements?.totalAverage?.weight),
      weighIns: summaries.map((day) => {
        const latest = day.latestWeight ?? {};
        return {
          date: day.summaryDate,
          kg: kgFromGrams(latest.weight),
          bodyFatPercent: round(latest.bodyFat, 1),
          muscleKg: kgFromGrams(latest.muscleMass),
          bodyWaterPercent: round(latest.bodyWater, 1),
          bmi: round(latest.bmi, 1),
        };
      }),
    });
  },
});
