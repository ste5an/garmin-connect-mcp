import { z } from 'zod';
import { clock } from './format';

type Raw = Record<string, any>;

const STRENGTH = { sportTypeId: 5, sportTypeKey: 'strength_training' };
const WORK_STEP = { stepTypeId: 3, stepTypeKey: 'interval' };
const REST_STEP = { stepTypeId: 5, stepTypeKey: 'rest' };
const REPEAT_STEP_TYPE = { stepTypeId: 6, stepTypeKey: 'repeat' };
const REPS_CONDITION = { conditionTypeId: 10, conditionTypeKey: 'reps' };
const TIME_CONDITION = { conditionTypeId: 2, conditionTypeKey: 'time' };
const ITERATIONS_CONDITION = { conditionTypeId: 7, conditionTypeKey: 'iterations' };
const NO_TARGET = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' };
const KILOGRAM = { unitId: 8, unitKey: 'kilogram', factor: 1000 };
const KG_PER_LB = 0.45359237;
const GARMIN_KEY_PATTERN = /^[A-Z][A-Z0-9_]*$/;

export const strengthExerciseSchema = z.object({
  category: z.string().regex(GARMIN_KEY_PATTERN).describe('Garmin exercise category in upper snake case, for example SQUAT, BENCH_PRESS, PULL_UP, DEADLIFT, LUNGE, CALF_RAISE, CORE, PLANK.'),
  exerciseName: z.string().regex(GARMIN_KEY_PATTERN).optional().describe('Garmin exercise name in upper snake case within the category, for example ROMANIAN_DEADLIFT. Omit to let the watch show the category only.'),
  sets: z.number().int().min(1).max(10).describe('Number of sets.'),
  reps: z.number().int().min(1).max(100).describe('Reps per set.'),
  weightLb: z.number().positive().max(1000).optional().describe('Weight per set in pounds. Omit for bodyweight.'),
  restSeconds: z.number().int().min(0).max(600).optional().describe('Rest after each set in seconds. Omit or 0 for no timed rest.'),
});

export const strengthWorkoutExercisesSchema = z.array(strengthExerciseSchema).min(1).max(20);

export type StrengthExercise = z.infer<typeof strengthExerciseSchema>;

export function poundsToKilograms(pounds: number): number {
  return Math.round(pounds * KG_PER_LB * 10) / 10;
}

function buildWorkStep(exercise: StrengthExercise, stepOrder: number): Raw {
  return {
    type: 'ExecutableStepDTO',
    stepOrder,
    stepType: WORK_STEP,
    endCondition: REPS_CONDITION,
    endConditionValue: exercise.reps,
    targetType: NO_TARGET,
    category: exercise.category,
    ...(exercise.exerciseName ? { exerciseName: exercise.exerciseName } : {}),
    ...(exercise.weightLb ? { weightValue: poundsToKilograms(exercise.weightLb), weightUnit: KILOGRAM } : {}),
  };
}

function buildRestStep(seconds: number, stepOrder: number): Raw {
  return {
    type: 'ExecutableStepDTO',
    stepOrder,
    stepType: REST_STEP,
    endCondition: TIME_CONDITION,
    endConditionValue: seconds,
    targetType: NO_TARGET,
  };
}

export function buildStrengthWorkout(workoutName: string, exercises: StrengthExercise[]): Raw {
  let order = 0;
  const groups = exercises.map((exercise) => {
    order += 1;
    const stepOrder = order;
    order += 1;
    const steps = [buildWorkStep(exercise, order)];
    if (exercise.restSeconds) {
      order += 1;
      steps.push(buildRestStep(exercise.restSeconds, order));
    }
    return {
      type: 'RepeatGroupDTO',
      stepOrder,
      stepType: REPEAT_STEP_TYPE,
      numberOfIterations: exercise.sets,
      endCondition: ITERATIONS_CONDITION,
      endConditionValue: exercise.sets,
      workoutSteps: steps,
    };
  });

  return {
    workoutName,
    sportType: STRENGTH,
    workoutSegments: [{ segmentOrder: 1, sportType: STRENGTH, workoutSteps: groups }],
  };
}

export function describeStrengthWorkout(exercises: StrengthExercise[]): string[] {
  return exercises.map((exercise) => {
    const label = (exercise.exerciseName ?? exercise.category).toLowerCase().replace(/_/g, ' ');
    const weight = exercise.weightLb ? ` at ${exercise.weightLb} lb` : '';
    const rest = exercise.restSeconds ? `, ${clock(exercise.restSeconds)} rest` : '';
    return `${label}: ${exercise.sets} x ${exercise.reps}${weight}${rest}`;
  });
}
