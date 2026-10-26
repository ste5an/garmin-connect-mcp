import { describe, expect, it } from 'vitest';
import { detectIntervals, parsePoints, summarizeSplits, type Point } from './splits';

function course(legs: [seconds: number, metersPerSecond: number, hr?: number][]): Point[] {
  const points: Point[] = [{ seconds: 0, meters: 0 }];
  for (const [duration, speed, hr] of legs) {
    for (let second = 1; second <= duration; second++) {
      const last = points[points.length - 1]!;
      points.push({ seconds: last.seconds + 1, meters: last.meters + speed, hr });
    }
  }
  return points;
}

describe('parsePoints', () => {
  const details = {
    metricDescriptors: [
      { metricsIndex: 0, key: 'sumDuration' },
      { metricsIndex: 1, key: 'sumDistance' },
      { metricsIndex: 2, key: 'directHeartRate' },
    ],
    activityDetailMetrics: [
      { metrics: [0, 0, null] },
      { metrics: [2, 6, 120] },
      { metrics: [2, 7, 121] },
      { metrics: [4, 12, 0] },
      { metrics: [null, 14, 130] },
    ],
  };

  it('reads time, distance and heart rate and skips repeated or invalid rows', () => {
    expect(parsePoints(details)).toEqual([
      { seconds: 0, meters: 0, hr: undefined },
      { seconds: 2, meters: 6, hr: 120 },
      { seconds: 4, meters: 12, hr: undefined },
    ]);
  });

  it('returns nothing when the metrics are missing', () => {
    expect(parsePoints({ metricDescriptors: [], activityDetailMetrics: [] })).toEqual([]);
    expect(parsePoints(null)).toEqual([]);
  });
});

describe('summarizeSplits', () => {
  it('splits a steady run into kilometres with pace and heart rate', () => {
    const splits = summarizeSplits(course([[1500, 4, 150]]));
    expect(splits).toHaveLength(6);
    expect(splits?.[0]).toMatchObject({ km: 1, time: '4:10', pacePerKm: '4:10', avgHr: 150 });
  });

  it('labels a trailing partial kilometre with its distance', () => {
    const splits = summarizeSplits(course([[630, 4]]));
    expect(splits).toHaveLength(3);
    expect(splits?.[2]).toMatchObject({ km: 3, distanceKm: 0.52 });
  });

  it('returns nothing for a very short or empty run', () => {
    expect(summarizeSplits([])).toBeUndefined();
    expect(summarizeSplits(course([[10, 4]]))).toBeUndefined();
  });
});

describe('detectIntervals', () => {
  const warmup: [number, number, number] = [600, 2.8, 140];
  const rep: [number, number, number] = [480, 3.4, 175];
  const jog: [number, number, number] = [180, 2.2, 150];
  const cooldown: [number, number, number] = [600, 2.8, 150];

  it('finds work and recovery reps with warm-up and cool-down', () => {
    const result = detectIntervals(course([warmup, rep, jog, rep, jog, rep, cooldown]));
    expect(result?.work).toMatchObject({ count: 3 });
    expect(result?.recovery).toMatchObject({ count: 2 });
    expect(result?.work?.avgHr).toBeCloseTo(175, -1);
    expect(result?.recovery?.avgHr).toBeCloseTo(150, -1);
    expect(result?.steps?.map((step: { type: string }) => step.type)).toEqual([
      'warmup',
      'work',
      'recovery',
      'work',
      'recovery',
      'work',
      'cooldown',
    ]);
    expect(result?.steps?.[1]).toMatchObject({ pacePerKm: '4:54' });
  });

  it('reports a single continuous block as one work step', () => {
    const result = detectIntervals(course([warmup, [1200, 3.5, 178], cooldown]));
    expect(result?.work).toMatchObject({ count: 1 });
    expect(result?.recovery).toBeUndefined();
  });

  it('ignores a steady run', () => {
    expect(detectIntervals(course([[3000, 2.7, 150]]))).toBeUndefined();
  });

  it('ignores a steady run with a short walk or stop', () => {
    expect(detectIntervals(course([[1500, 2.4, 130], [60, 0.5, 120], [1500, 2.4, 130]]))).toBeUndefined();
  });

  it('ignores a run with too little data', () => {
    expect(detectIntervals(course([[20, 3]]))).toBeUndefined();
  });
});
