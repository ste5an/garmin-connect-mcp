import { z } from 'zod';
import { defineTool } from './define';
import { clock, compact, hoursMinutes, km, pacePerKm } from './format';

type Raw = Record<string, any>;

function describeTarget(step: Raw): string | undefined {
  const key: string | undefined = step.targetType?.workoutTargetTypeKey;
  if (!key || key === 'no.target') return undefined;
  const low = step.targetValueOne;
  const high = step.targetValueTwo;
  if (key === 'pace.zone' && low && high) return `${pacePerKm(Math.max(low, high))}-${pacePerKm(Math.min(low, high))}/km`;
  if (key === 'heart.rate.zone' && low && high) return `${Math.round(low)}-${Math.round(high)} bpm`;
  if (key.endsWith('.zone') && step.zoneNumber) return `zone ${step.zoneNumber}`;
  return key;
}

function describeEnd(step: Raw): string {
  const key: string | undefined = step.endCondition?.conditionTypeKey;
  const value: number | undefined = step.endConditionValue;
  if (key === 'time' && value) return clock(value)!;
  if (key === 'distance' && value) return value >= 1000 ? `${km(value, 1)} km` : `${Math.round(value)} m`;
  return key === 'lap.button' ? 'until lap press' : (key ?? '');
}

function describeStep(step: Raw): string {
  if (Array.isArray(step.workoutSteps)) {
    const inner = step.workoutSteps.map(describeStep).join(' + ');
    return `${step.numberOfIterations}x(${inner})`;
  }
  const kind = step.stepType?.stepTypeKey ?? 'step';
  const target = describeTarget(step);
  return `${kind} ${describeEnd(step)}${target ? ` @ ${target}` : ''}`;
}

export const workouts = defineTool({
  name: 'workouts',
  title: 'Saved workouts',
  description: 'Workouts saved in Garmin Connect. Without `id` it lists them; with `id` it returns the step-by-step structure (warm-up, intervals, targets).',
  input: {
    id: z.number().int().optional().describe('Workout id from the list.'),
    limit: z.number().int().min(1).max(100).optional().describe('Maximum workouts to list. Default 20.'),
  },
  run: async ({ id, limit }, { client }) => {
    if (id === undefined) {
      const list = (await client.getWorkouts(0, limit ?? 20)) as Raw[];
      return list.map((workout) =>
        compact({
          id: workout.workoutId,
          name: workout.workoutName,
          sport: workout.sportType?.sportTypeKey,
          distanceKm: km(workout.estimatedDistanceInMeters, 1),
          duration: hoursMinutes(workout.estimatedDurationInSecs),
          updated: workout.updateDate?.slice(0, 10),
        }),
      );
    }
    const workout = (await client.getWorkout(String(id))) as Raw;
    return compact({
      id: workout.workoutId,
      name: workout.workoutName,
      description: workout.description,
      distanceKm: km(workout.estimatedDistanceInMeters, 1),
      duration: hoursMinutes(workout.estimatedDurationInSecs),
      steps: (workout.workoutSegments ?? []).flatMap((segment: Raw) => (segment.workoutSteps ?? []).map(describeStep)),
    });
  },
});
