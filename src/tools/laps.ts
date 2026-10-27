import { clock, compact, pacePerKm, round } from './format';
import { describeWindow, measure, type Point } from './splits';

type Raw = Record<string, any>;
type LapType = 'warmup' | 'work' | 'recovery' | 'cooldown';

export type LapPlan = { type: LapType; seconds: number; targetLow?: number; targetHigh?: number };

const TIMED_STEP = 'TIME';
const REPEAT_STEP = 'REPEAT_UNTIL_STEPS_CMPLT';
const DURATION_TOLERANCE_SECONDS = 3;

const LAP_TYPES: Record<string, LapType> = {
  WARMUP: 'warmup',
  INTERVAL: 'work',
  ACTIVE: 'work',
  RECOVERY: 'recovery',
  REST: 'recovery',
  COOLDOWN: 'cooldown',
};

const SPLIT_TYPES: Record<LapType, string> = {
  warmup: 'INTERVAL_WARMUP',
  work: 'INTERVAL_ACTIVE',
  recovery: 'INTERVAL_RECOVERY',
  cooldown: 'INTERVAL_COOLDOWN',
};

export function expandWorkoutSteps(steps: Raw[] | null | undefined): LapPlan[] | undefined {
  if (!steps?.length) return undefined;
  const plan: LapPlan[] = [];
  const planLengthAt = new Map<number, number>();

  for (const [position, step] of steps.entries()) {
    const index = step.stepIndex ?? position;
    planLengthAt.set(index, plan.length);

    if (step.durationType === REPEAT_STEP) {
      const first = planLengthAt.get(step.durationValue);
      if (first === undefined || !(step.targetValue >= 1)) return undefined;
      const block = plan.slice(first);
      for (let repeat = 1; repeat < step.targetValue; repeat++) plan.push(...block.map((lap) => ({ ...lap })));
      continue;
    }

    const type = LAP_TYPES[step.intensity];
    if (step.durationType !== TIMED_STEP || !type || !(step.durationValue > 0)) return undefined;
    const hasTarget = step.targetType === 'SPEED' && step.targetValueLow > 0 && step.targetValueHigh > 0;
    plan.push({
      type,
      seconds: step.durationValue,
      targetLow: hasTarget ? step.targetValueLow : undefined,
      targetHigh: hasTarget ? step.targetValueHigh : undefined,
    });
  }
  return plan;
}

export function withoutFinalRecovery(plan: LapPlan[]): LapPlan[] {
  const last = plan.length - 1;
  const index = plan[last]?.type === 'cooldown' ? last - 1 : last;
  return plan[index]?.type === 'recovery' ? plan.filter((_, position) => position !== index) : plan;
}

export function matchesSplitSummaries(plan: LapPlan[], totalSeconds: number, summaries: Raw[] | null | undefined): boolean {
  if (!summaries?.length) return false;
  const plannedBeforeLast = plan.slice(0, -1).reduce((sum, lap) => sum + lap.seconds, 0);
  if (plannedBeforeLast >= totalSeconds) return false;

  const actual = plan.map((lap, index) => (index === plan.length - 1 ? totalSeconds - plannedBeforeLast : lap.seconds));
  return (Object.keys(SPLIT_TYPES) as LapType[]).every((type) => {
    const laps = plan.map((lap, index) => ({ lap, seconds: actual[index]! })).filter((item) => item.lap.type === type);
    const summary = summaries.find((item) => item.splitType === SPLIT_TYPES[type]);
    if (!laps.length || !summary) return laps.length === 0 && !summary;
    const seconds = laps.reduce((sum, item) => sum + item.seconds, 0);
    return summary.noOfSplits === laps.length && Math.abs(summary.duration - seconds) <= DURATION_TOLERANCE_SECONDS * laps.length;
  });
}

function paceRange(low: number | undefined, high: number | undefined): string | undefined {
  if (!low || !high) return undefined;
  return `${pacePerKm(high)}-${pacePerKm(low)}`;
}

export function summarizeLaps(points: Point[], plan: LapPlan[]) {
  const origin = points[0]!.seconds;
  const end = points[points.length - 1]!.seconds;
  let cursor = origin;

  const laps = plan.map((lap, index) => {
    const from = cursor;
    const to = index === plan.length - 1 ? end : Math.min(end, from + lap.seconds);
    cursor = to;
    const window = measure(points, from, to);
    const speed = window.meters / window.seconds;
    return {
      type: lap.type,
      window,
      speed,
      row: compact({
        lap: index + 1,
        type: lap.type,
        time: clock(window.seconds),
        distanceM: round(window.meters),
        pacePerKm: pacePerKm(speed),
        targetPace: paceRange(lap.targetLow, lap.targetHigh),
        inTarget: lap.targetLow && lap.targetHigh ? speed >= lap.targetLow && speed <= lap.targetHigh : undefined,
        ...describeWindow(window),
      }),
    };
  });

  const reps = laps.filter((lap) => lap.type === 'work');
  const meters = reps.reduce((sum, lap) => sum + lap.window.meters, 0);
  const seconds = reps.reduce((sum, lap) => sum + lap.window.seconds, 0);
  const speeds = reps.map((lap) => lap.speed);
  const first = reps[0]?.window.avgHr;
  const last = reps[reps.length - 1]?.window.avgHr;

  return {
    laps: laps.map((lap) => lap.row),
    work: reps.length
      ? compact({
          reps: reps.length,
          pacePerKm: pacePerKm(meters / seconds),
          fastestPace: pacePerKm(Math.max(...speeds)),
          slowestPace: pacePerKm(Math.min(...speeds)),
          hrFirstToLast: first !== undefined && last !== undefined ? [first, last] : undefined,
        })
      : undefined,
  };
}

export function buildActivityLaps(points: Point[], workouts: unknown, activity: Raw | null | undefined) {
  if (points.length < 2 || !Array.isArray(workouts)) return undefined;
  const steps = (workouts as Raw[]).find((workout) => workout.steps?.length)?.steps;
  const expanded = expandWorkoutSteps(steps);
  if (!expanded) return undefined;
  const totalSeconds = points[points.length - 1]!.seconds - points[0]!.seconds;
  const plan = [expanded, withoutFinalRecovery(expanded)].find((candidate) =>
    matchesSplitSummaries(candidate, totalSeconds, activity?.splitSummaries),
  );
  if (!plan) return undefined;
  return {
    method: 'Rebuilt from the timed steps of the structured workout, checked against Garmin step totals.',
    ...summarizeLaps(points, plan),
  };
}
