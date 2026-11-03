import { describe, expect, it } from 'vitest';
import { buildActivityLaps, expandWorkoutSteps, matchesSplitSummaries, summarizeLaps } from './laps';
import { parsePoints, type Point } from './splits';

const speedStep = (stepIndex: number, intensity: string, seconds: number, low: number, high: number) => ({
  stepIndex,
  intensity,
  durationType: 'TIME',
  durationValue: seconds,
  targetType: 'SPEED',
  targetValue: 0,
  targetValueLow: low,
  targetValueHigh: high,
});

const vo2Steps = [
  speedStep(0, 'WARMUP', 600, 2.611, 2.972),
  speedStep(1, 'INTERVAL', 240, 3.555, 3.972),
  speedStep(2, 'RECOVERY', 120, 2.055, 2.611),
  { stepIndex: 3, intensity: 'ACTIVE', durationType: 'REPEAT_UNTIL_STEPS_CMPLT', durationValue: 1, targetValue: 4 },
  speedStep(4, 'COOLDOWN', 600, 2.611, 2.972),
];

const sprintSteps = [
  speedStep(0, 'WARMUP', 900, 2.666, 3),
  speedStep(1, 'INTERVAL', 15, 5.194, 6),
  { stepIndex: 2, intensity: 'REST', durationType: 'TIME', durationValue: 180, targetType: 'OPEN', targetValue: 0 },
  { stepIndex: 3, intensity: 'ACTIVE', durationType: 'REPEAT_UNTIL_STEPS_CMPLT', durationValue: 1, targetValue: 3 },
  speedStep(4, 'RECOVERY', 300, 2.111, 2.666),
  { stepIndex: 5, intensity: 'ACTIVE', durationType: 'REPEAT_UNTIL_STEPS_CMPLT', durationValue: 1, targetValue: 2 },
  speedStep(6, 'COOLDOWN', 600, 2.666, 3),
];

const sprintSummaries = [
  { splitType: 'INTERVAL_WARMUP', noOfSplits: 1, duration: 900 },
  { splitType: 'INTERVAL_ACTIVE', noOfSplits: 6, duration: 90 },
  { splitType: 'INTERVAL_REST', noOfSplits: 4, duration: 720 },
  { splitType: 'INTERVAL_RECOVERY', noOfSplits: 1, duration: 300 },
  { splitType: 'INTERVAL_COOLDOWN', noOfSplits: 1, duration: 611 },
];

function course(legs: [seconds: number, metersPerSecond: number, hr: number][]): Point[] {
  const points: Point[] = [{ seconds: 0, meters: 0 }];
  for (const [duration, speed, hr] of legs) {
    for (let second = 1; second <= duration; second++) {
      const last = points[points.length - 1]!;
      points.push({ seconds: last.seconds + 1, meters: last.meters + speed, hr, power: hr + 100, cadence: 170 });
    }
  }
  return points;
}

const summaries = [
  { splitType: 'INTERVAL_WARMUP', noOfSplits: 1, duration: 600 },
  { splitType: 'INTERVAL_ACTIVE', noOfSplits: 4, duration: 960 },
  { splitType: 'INTERVAL_RECOVERY', noOfSplits: 3, duration: 360 },
  { splitType: 'INTERVAL_COOLDOWN', noOfSplits: 1, duration: 605 },
];

const run = course([
  [600, 2.9, 147],
  [240, 3.8, 175],
  [120, 1.5, 150],
  [240, 3.8, 178],
  [120, 1.5, 150],
  [240, 3.7, 182],
  [120, 1.5, 150],
  [240, 3.6, 186],
  [605, 2.7, 160],
]);

describe('expandWorkoutSteps', () => {
  it('unrolls a repeat block into one lap per step', () => {
    const plan = expandWorkoutSteps(vo2Steps)!;
    expect(plan.map((lap) => lap.type)).toEqual([
      'warmup', 'work', 'recovery', 'work', 'recovery', 'work', 'recovery', 'work', 'recovery', 'cooldown',
    ]);
    expect(plan[1]).toMatchObject({ seconds: 240, targetLow: 3.555, targetHigh: 3.972 });
  });

  it('gives up on steps that are not timed', () => {
    expect(expandWorkoutSteps([{ ...vo2Steps[0], durationType: 'LAP_BUTTON' }])).toBeUndefined();
    expect(expandWorkoutSteps([])).toBeUndefined();
  });

  it('gives up on a repeat that points at no earlier step', () => {
    expect(expandWorkoutSteps([{ stepIndex: 0, durationType: 'REPEAT_UNTIL_STEPS_CMPLT', durationValue: 7, targetValue: 2 }])).toBeUndefined();
  });
});

describe('expandWorkoutSteps with skipLastBreak', () => {
  it('drops the recovery after the last rep, as the watch does', () => {
    const plan = expandWorkoutSteps(vo2Steps, true)!;
    expect(plan.map((lap) => lap.type).join(',')).toBe('warmup,work,recovery,work,recovery,work,recovery,work,cooldown');
  });

  it('drops the last rest of every set in nested repeats', () => {
    const plan = expandWorkoutSteps(sprintSteps, true)!;
    expect(plan.map((lap) => lap.type).join(',')).toBe(
      'warmup,work,rest,work,rest,work,recovery,work,rest,work,rest,work,cooldown',
    );
  });
});

describe('matchesSplitSummaries', () => {
  it('accepts a plan whose counts and durations agree with Garmin', () => {
    const plan = expandWorkoutSteps(vo2Steps, true)!;
    expect(matchesSplitSummaries(plan, 2525, summaries)).toBe(true);
  });

  it('rejects a plan with the wrong number of recoveries', () => {
    expect(matchesSplitSummaries(expandWorkoutSteps(vo2Steps)!, 2525, summaries)).toBe(false);
  });

  it('rejects when Garmin has no step totals', () => {
    expect(matchesSplitSummaries(expandWorkoutSteps(vo2Steps)!, 2525, undefined)).toBe(false);
  });
});

describe('buildActivityLaps', () => {
  const result = buildActivityLaps(run, [{ steps: vo2Steps }], { splitSummaries: summaries })!;

  it('measures every step with pace, target and heart rate', () => {
    expect(result.laps).toHaveLength(9);
    expect(result.laps[1]).toMatchObject({
      lap: 2,
      type: 'work',
      time: '4:00',
      distanceM: 912,
      pacePerKm: '4:23',
      targetPace: '4:12-4:41',
      inTarget: true,
      avgHr: 175,
      avgPowerW: 275,
      cadence: 170,
    });
    expect(result.laps[8]).toMatchObject({ type: 'cooldown', time: '10:05' });
  });

  it('flags a rep outside the target range', () => {
    expect(result.laps[7]).toMatchObject({ type: 'work', pacePerKm: '4:38', inTarget: true });
    const slow = buildActivityLaps(
      course([[600, 2.9, 147], [240, 3.0, 175], [120, 1.5, 150], [240, 3.8, 178], [120, 1.5, 150], [240, 3.8, 178], [120, 1.5, 150], [240, 3.8, 178], [605, 2.7, 160]]),
      [{ steps: vo2Steps }],
      { splitSummaries: summaries },
    )!;
    expect(slow.laps[1]).toMatchObject({ pacePerKm: '5:33', inTarget: false });
  });

  it('summarizes the work reps', () => {
    expect(result.work).toMatchObject({ reps: 4, fastestPace: '4:23', slowestPace: '4:38', hrFirstToLast: [175, 186] });
  });

  it('rebuilds a sprint session with rests kept apart from recoveries', () => {
    const sprint = buildActivityLaps(
      course([
        [900, 2.9, 151],
        ...Array.from({ length: 2 }, (_, set) => [
          [15, 5.8, 170], [180, 2.5, 162], [15, 5.8, 170], [180, 2.5, 162], [15, 5.8, 170],
          ...(set === 0 ? [[300, 2.6, 159]] : []),
        ]).flat() as [number, number, number][],
        [611, 2.7, 173],
      ]),
      [{ steps: sprintSteps }],
      { splitSummaries: sprintSummaries },
    )!;
    expect(sprint.laps.map((lap) => lap.type).filter((type) => type === 'rest')).toHaveLength(4);
    expect(sprint.laps[6]).toMatchObject({ type: 'recovery', time: '5:00' });
    expect(sprint.laps[12]).toMatchObject({ type: 'cooldown', time: '10:11', avgHr: 173 });
    expect(sprint.work).toMatchObject({ reps: 6 });
  });

  it('returns nothing when the laps do not match Garmin totals', () => {
    expect(buildActivityLaps(run, [{ steps: vo2Steps }], { splitSummaries: [{ splitType: 'INTERVAL_ACTIVE', noOfSplits: 5, duration: 960 }] })).toBeUndefined();
    expect(buildActivityLaps(run, [], { splitSummaries: summaries })).toBeUndefined();
    expect(buildActivityLaps([], [{ steps: vo2Steps }], { splitSummaries: summaries })).toBeUndefined();
  });
});

describe('summarizeLaps', () => {
  it('stretches the last lap to the end of the activity', () => {
    const plan = expandWorkoutSteps([speedStep(0, 'WARMUP', 100, 2, 3), speedStep(1, 'COOLDOWN', 100, 2, 3)])!;
    const { laps } = summarizeLaps(course([[100, 2.5, 140], [130, 2.5, 140]]), plan);
    expect(laps[1]).toMatchObject({ time: '2:10' });
  });
});

describe('parsePoints', () => {
  it('reads running dynamics from the stream', () => {
    const details = {
      metricDescriptors: [
        { metricsIndex: 0, key: 'sumDuration' },
        { metricsIndex: 1, key: 'sumDistance' },
        { metricsIndex: 2, key: 'directPower' },
        { metricsIndex: 3, key: 'directDoubleCadence' },
        { metricsIndex: 4, key: 'directGroundContactTime' },
        { metricsIndex: 5, key: 'directElevation' },
      ],
      activityDetailMetrics: [{ metrics: [1, 3, 250, 168, 240, -2.5] }],
    };
    expect(parsePoints(details)[0]).toMatchObject({ power: 250, cadence: 168, groundContactMs: 240, elevation: -2.5 });
  });
});
