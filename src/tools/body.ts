import { rangeFields, resolveRange } from './dates';
import { defineTool, gather } from './define';
import { compact, kgFromGrams, round } from './format';

type Raw = Record<string, any>;

export const body = defineTool({
  name: 'body',
  title: 'Weight and body composition',
  description: 'Weigh-ins (kg, body fat, muscle, BMI) and blood pressure readings for a period. Defaults to the last 30 days.',
  input: rangeFields,
  run: async ({ from, to, days }, { client }) => {
    const range = resolveRange({ from, to, days }, 30);
    const { data, unavailable } = await gather({
      weighIns: () => client.getWeighIns(range.from, range.to),
      pressure: () => client.getBloodPressure(range.from, range.to),
    });
    const summaries: Raw[] = (data.weighIns as Raw | undefined)?.dailyWeightSummaries ?? [];
    const average = (data.weighIns as Raw | undefined)?.totalAverage;
    return compact({
      from: range.from,
      to: range.to,
      averageKg: kgFromGrams(average?.weight),
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
      bloodPressure: ((data.pressure as Raw | undefined)?.measurementSummaries ?? []).map((entry: Raw) => ({
        date: entry.summaryDate,
        measurements: entry.measurements?.map((m: Raw) => ({ systolic: m.systolic, diastolic: m.diastolic, pulse: m.pulse })),
      })),
      unavailable,
    });
  },
});
