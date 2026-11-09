import { describe, expect, it } from 'vitest';
import { buildStrengthWorkout, describeStrengthWorkout, poundsToKilograms, type StrengthExercise } from './strength-builder';

const exercises: StrengthExercise[] = [
  { category: 'SQUAT', exerciseName: 'BARBELL_BACK_SQUAT', sets: 3, reps: 6, weightLb: 60, restSeconds: 90 },
  { category: 'CORE', exerciseName: 'DEAD_BUG', sets: 2, reps: 8 },
];

describe('poundsToKilograms', () => {
  it('converts to one decimal', () => {
    expect(poundsToKilograms(60)).toBe(27.2);
    expect(poundsToKilograms(135)).toBe(61.2);
  });
});

describe('buildStrengthWorkout', () => {
  const workout = buildStrengthWorkout('Lower body', exercises);
  const [squat, deadBug] = workout.workoutSegments[0].workoutSteps;

  it('uses the strength sport type', () => {
    expect(workout.sportType.sportTypeKey).toBe('strength_training');
    expect(workout.workoutSegments[0].sportType.sportTypeKey).toBe('strength_training');
  });

  it('wraps each exercise in a repeat group of its sets', () => {
    expect(squat.type).toBe('RepeatGroupDTO');
    expect(squat.numberOfIterations).toBe(3);
    expect(deadBug.numberOfIterations).toBe(2);
  });

  it('numbers steps in order including children', () => {
    expect(squat.stepOrder).toBe(1);
    expect(squat.workoutSteps.map((step: any) => step.stepOrder)).toEqual([2, 3]);
    expect(deadBug.stepOrder).toBe(4);
    expect(deadBug.workoutSteps.map((step: any) => step.stepOrder)).toEqual([5]);
  });

  it('ends the work step on reps with the exercise and weight in kilograms', () => {
    const work = squat.workoutSteps[0];
    expect(work.endCondition.conditionTypeKey).toBe('reps');
    expect(work.endConditionValue).toBe(6);
    expect(work.category).toBe('SQUAT');
    expect(work.exerciseName).toBe('BARBELL_BACK_SQUAT');
    expect(work.weightValue).toBe(27.2);
    expect(work.weightUnit.unitKey).toBe('kilogram');
  });

  it('adds a timed rest step only when rest is given', () => {
    expect(squat.workoutSteps[1].stepType.stepTypeKey).toBe('rest');
    expect(squat.workoutSteps[1].endConditionValue).toBe(90);
    expect(deadBug.workoutSteps).toHaveLength(1);
  });

  it('leaves bodyweight exercises without a weight', () => {
    expect(deadBug.workoutSteps[0].weightValue).toBeUndefined();
  });
});

describe('describeStrengthWorkout', () => {
  it('summarizes each exercise', () => {
    expect(describeStrengthWorkout(exercises)).toEqual([
      'barbell back squat: 3 x 6 at 60 lb, 1:30 rest',
      'dead bug: 2 x 8',
    ]);
  });
});
