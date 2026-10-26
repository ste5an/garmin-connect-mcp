import { clock, compact, km, pacePerKm, round } from './format';

type Raw = Record<string, any>;
type Axis = 'seconds' | 'meters';
type Kind = 'fast' | 'slow';

export type Point = { seconds: number; meters: number; hr?: number };
type Run = { kind: Kind; from: number; to: number };

const SMOOTHING_SECONDS = 10;
const MIN_RUN_SECONDS = 30;
const MIN_REP_SECONDS = 45;
const MIN_REPS = 1;
const MIN_MOVING_SPEED = 1;
const MIN_SPEED_RATIO = 1.2;
const MIN_CLUSTER_SHARE = 0.08;
const CLUSTER_ITERATIONS = 20;
const MIN_SPLIT_METERS = 100;
const METERS_PER_KM = 1000;

export function parsePoints(details: Raw | null | undefined): Point[] {
  const descriptors: Raw[] = details?.metricDescriptors ?? [];
  const indexOf = (key: string): number | undefined => descriptors.find((item) => item.key === key)?.metricsIndex;
  const secondsAt = indexOf('sumDuration');
  const metersAt = indexOf('sumDistance');
  const hrAt = indexOf('directHeartRate');
  if (secondsAt === undefined || metersAt === undefined) return [];

  const points: Point[] = [];
  for (const row of details?.activityDetailMetrics ?? []) {
    const metrics: unknown[] = row.metrics ?? [];
    const seconds = metrics[secondsAt];
    const meters = metrics[metersAt];
    if (typeof seconds !== 'number' || typeof meters !== 'number') continue;
    const last = points[points.length - 1];
    if (last && (seconds <= last.seconds || meters < last.meters)) continue;
    const hr = hrAt === undefined ? undefined : metrics[hrAt];
    points.push({ seconds, meters, hr: typeof hr === 'number' && hr > 0 ? hr : undefined });
  }
  return points;
}

function interpolate(points: Point[], from: Axis, to: Axis, value: number): number {
  let low = 0;
  let high = points.length - 1;
  if (value <= points[low]![from]) return points[low]![to];
  if (value >= points[high]![from]) return points[high]![to];
  while (high - low > 1) {
    const middle = (low + high) >> 1;
    if (points[middle]![from] <= value) low = middle;
    else high = middle;
  }
  const span = points[high]![from] - points[low]![from];
  const share = span === 0 ? 0 : (value - points[low]![from]) / span;
  return points[low]![to] + share * (points[high]![to] - points[low]![to]);
}

function measure(points: Point[], startSeconds: number, endSeconds: number) {
  const seconds = endSeconds - startSeconds;
  const meters = interpolate(points, 'seconds', 'meters', endSeconds) - interpolate(points, 'seconds', 'meters', startSeconds);
  const heartRates = points
    .filter((point) => point.seconds > startSeconds && point.seconds <= endSeconds && point.hr !== undefined)
    .map((point) => point.hr!);
  return {
    meters,
    seconds,
    avgHr: heartRates.length ? round(heartRates.reduce((sum, value) => sum + value, 0) / heartRates.length) : undefined,
    maxHr: heartRates.length ? Math.max(...heartRates) : undefined,
  };
}

export function summarizeSplits(points: Point[]) {
  const total = points[points.length - 1]?.meters ?? 0;
  if (points.length < 2 || total < MIN_SPLIT_METERS) return undefined;

  const ends: number[] = [];
  for (let meters = METERS_PER_KM; meters <= total; meters += METERS_PER_KM) ends.push(meters);
  if (total - (ends[ends.length - 1] ?? 0) >= MIN_SPLIT_METERS) ends.push(total);

  return ends.map((end, index) => {
    const start = ends[index - 1] ?? 0;
    const lap = measure(
      points,
      interpolate(points, 'meters', 'seconds', start),
      interpolate(points, 'meters', 'seconds', end),
    );
    return compact({
      km: index + 1,
      distanceKm: end - start < METERS_PER_KM ? km(end - start) : undefined,
      time: clock(lap.seconds),
      pacePerKm: pacePerKm((end - start) / lap.seconds),
      avgHr: lap.avgHr,
      maxHr: lap.maxHr,
    });
  });
}

function smoothedSpeeds(points: Point[]): number[] {
  const start = points[0]!.seconds;
  const end = points[points.length - 1]!.seconds;
  const speeds: number[] = [];
  for (let second = Math.ceil(start); second < Math.floor(end); second++) {
    const from = Math.max(start, second - SMOOTHING_SECONDS);
    const to = Math.min(end, second + SMOOTHING_SECONDS);
    const distance = interpolate(points, 'seconds', 'meters', to) - interpolate(points, 'seconds', 'meters', from);
    speeds.push(distance / (to - from));
  }
  return speeds;
}

function quantile(sorted: number[], share: number): number {
  return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * share))]!;
}

function clusterCenters(speeds: number[]): { slow: number; fast: number; fastShare: number } {
  const sorted = [...speeds].sort((a, b) => a - b);
  let slow = quantile(sorted, 0.1);
  let fast = quantile(sorted, 0.9);
  let fastShare = 0.5;
  for (let step = 0; step < CLUSTER_ITERATIONS; step++) {
    const middle = (slow + fast) / 2;
    const lower = speeds.filter((speed) => speed <= middle);
    const upper = speeds.filter((speed) => speed > middle);
    if (!lower.length || !upper.length) break;
    slow = lower.reduce((sum, speed) => sum + speed, 0) / lower.length;
    fast = upper.reduce((sum, speed) => sum + speed, 0) / upper.length;
    fastShare = upper.length / speeds.length;
  }
  return { slow, fast, fastShare };
}

function toRuns(speeds: number[], threshold: number): Run[] {
  const runs: Run[] = [];
  speeds.forEach((speed, index) => {
    const kind: Kind = speed > threshold ? 'fast' : 'slow';
    const last = runs[runs.length - 1];
    if (last && last.kind === kind) last.to = index + 1;
    else runs.push({ kind, from: index, to: index + 1 });
  });
  return runs;
}

function absorbShortRuns(runs: Run[]): Run[] {
  let current = runs;
  while (current.length > 1) {
    const shortest = current.reduce((best, run, index) =>
      run.to - run.from < current[best]!.to - current[best]!.from ? index : best, 0);
    const run = current[shortest]!;
    if (run.to - run.from >= MIN_RUN_SECONDS) break;
    const before = current[shortest - 1];
    const after = current[shortest + 1];
    const target = !after || (before && before.to - before.from >= after.to - after.from) ? before! : after;
    const merged = current.filter((item) => item !== run);
    target.from = Math.min(target.from, run.from);
    target.to = Math.max(target.to, run.to);
    current = merged.reduce<Run[]>((joined, item) => {
      const last = joined[joined.length - 1];
      if (last && last.kind === item.kind) last.to = Math.max(last.to, item.to);
      else joined.push(item);
      return joined;
    }, []);
  }
  return current;
}

export function detectIntervals(points: Point[]) {
  if (points.length < 2) return undefined;
  const speeds = smoothedSpeeds(points);
  if (speeds.length < MIN_REP_SECONDS) return undefined;

  const moving = speeds.filter((speed) => speed >= MIN_MOVING_SPEED);
  if (moving.length < MIN_REP_SECONDS) return undefined;

  const { slow, fast, fastShare } = clusterCenters(moving);
  if (slow <= 0 || fast / slow < MIN_SPEED_RATIO) return undefined;
  if (fastShare < MIN_CLUSTER_SHARE || fastShare > 1 - MIN_CLUSTER_SHARE) return undefined;

  const runs = absorbShortRuns(toRuns(speeds, (slow + fast) / 2));
  const reps = runs.filter((run) => run.kind === 'fast' && run.to - run.from >= MIN_REP_SECONDS);
  if (reps.length < MIN_REPS) return undefined;

  const origin = Math.ceil(points[0]!.seconds);
  const firstRep = runs.indexOf(reps[0]!);
  const lastRep = runs.indexOf(reps[reps.length - 1]!);
  const steps = runs.map((run, index) => {
    const lap = measure(points, origin + run.from, origin + run.to);
    const type = run.kind === 'fast' ? 'work' : index < firstRep ? 'warmup' : index > lastRep ? 'cooldown' : 'recovery';
    return { type, ...lap };
  });

  const rollup = (type: string) => {
    const matching = steps.filter((step) => step.type === type);
    if (!matching.length) return undefined;
    const meters = matching.reduce((sum, step) => sum + step.meters, 0);
    const seconds = matching.reduce((sum, step) => sum + step.seconds, 0);
    const withHr = matching.filter((step) => step.avgHr !== undefined);
    const hrSeconds = withHr.reduce((sum, step) => sum + step.seconds, 0);
    return {
      count: matching.length,
      pacePerKm: pacePerKm(meters / seconds),
      avgHr: hrSeconds > 0 ? round(withHr.reduce((sum, step) => sum + step.avgHr! * step.seconds, 0) / hrSeconds) : undefined,
    };
  };

  return compact({
    method: 'Detected from pace changes, not from Garmin lap data. Boundaries can be off by several seconds.',
    work: rollup('work'),
    recovery: rollup('recovery'),
    steps: steps.map((step, index) =>
      compact({
        step: index + 1,
        type: step.type,
        km: km(step.meters),
        time: clock(step.seconds),
        pacePerKm: pacePerKm(step.meters / step.seconds),
        avgHr: step.avgHr,
        maxHr: step.maxHr,
      }),
    ),
  });
}
