import { z } from 'zod';
import { LegacyLoginRequiredError } from '../garmin/legacy-auth';
import { resolveDate } from './dates';
import { defineTool } from './define';
import { compact, round } from './format';

type Raw = Record<string, any>;

const GRAMS_PER_POUND = 453.592;
const SKIPPED_SET_SECONDS = 10;

export type StrengthSet = { reps?: number; weightLb?: number; seconds: number; skipped?: true };
export type StrengthExerciseSets = { exercise: string; sets: StrengthSet[]; totalReps: number; topWeightLb?: number; skippedSets?: number };

export function poundsFromGrams(grams: number | null | undefined): number | undefined {
  return grams ? round(grams / GRAMS_PER_POUND, 1) : undefined;
}

function exerciseLabel(set: Raw): string {
  const { category, name } = set.exercises?.[0] ?? {};
  const key = name ?? category ?? 'UNKNOWN';
  return key.toLowerCase().replace(/_/g, ' ');
}

function toSet(set: Raw): StrengthSet {
  const seconds = round(set.duration) ?? 0;
  return {
    reps: set.repetitionCount ?? undefined,
    weightLb: poundsFromGrams(set.weight),
    seconds,
    ...(seconds < SKIPPED_SET_SECONDS ? { skipped: true as const } : {}),
  };
}

/** Groups the working sets of a strength activity by exercise, in the order they were done. */
export function summarizeStrengthSets(raw: Raw | null | undefined): StrengthExerciseSets[] {
  const groups: { key: string; exercise: string; sets: StrengthSet[] }[] = [];
  for (const set of raw?.exerciseSets ?? []) {
    if (set.setType !== 'ACTIVE') continue;
    const exercise = exerciseLabel(set);
    const key = `${set.wktStepIndex ?? 'free'}:${exercise}`;
    const last = groups[groups.length - 1];
    if (last?.key === key) last.sets.push(toSet(set));
    else groups.push({ key, exercise, sets: [toSet(set)] });
  }
  return groups.map(({ exercise, sets }) => {
    const done = sets.filter((set) => !set.skipped);
    const weights = done.map((set) => set.weightLb ?? 0).filter((weight) => weight > 0);
    const skippedSets = sets.length - done.length;
    return {
      exercise,
      sets,
      totalReps: done.reduce((total, set) => total + (set.reps ?? 0), 0),
      ...(weights.length ? { topWeightLb: Math.max(...weights) } : {}),
      ...(skippedSets ? { skippedSets } : {}),
    };
  });
}

export const strengthSets = defineTool({
  name: 'strength_sets',
  title: 'Strength sets',
  description:
    'Every working set of a strength activity as recorded on the watch: exercise, reps, weight in pounds and set duration, grouped by exercise with total reps and top weight. ' +
    'Sets under 10 seconds are flagged as skipped (lap button pressed through) and left out of the totals. Pass an activity id, or a date to read every strength activity that day. Needs the optional email login.',
  input: {
    id: z.number().int().optional().describe('Strength activity id from `activities`.'),
    date: z.string().optional().describe('YYYY-MM-DD, "today" or "yesterday" when no id is given. Default today.'),
  },
  run: async ({ id, date }, { client }) => {
    if (!client.hasLegacyLogin) throw new LegacyLoginRequiredError();
    const day = resolveDate(date);
    const found = id
      ? [{ activityId: id }]
      : (((await client.getActivitiesByDate(day, day)) as Raw[] | undefined) ?? []).filter((raw) => raw.activityType?.typeKey === 'strength_training');
    const sessions = await Promise.all(
      found.map(async (raw) => ({
        id: raw.activityId,
        name: raw.activityName,
        start: raw.startTimeLocal,
        exercises: summarizeStrengthSets((await client.getExerciseSets(raw.activityId)) as Raw),
      })),
    );
    return compact({ date: id ? undefined : day, count: sessions.length, sessions });
  },
});
