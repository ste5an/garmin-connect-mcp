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

describe('timed holds', () => {
  const hold: StrengthExercise = { category: 'PLANK', exerciseName: 'SIDE_PLANK', sets: 4, holdSeconds: 30 };

  it('ends a hold on time', () => {
    const work = buildStrengthWorkout('Core', [hold]).workoutSegments[0].workoutSteps[0].workoutSteps[0];
    expect(work.endCondition.conditionTypeKey).toBe('time');
    expect(work.endConditionValue).toBe(30);
  });

  it('rejects an exercise with both or neither of reps and holdSeconds', () => {
    expect(() => buildStrengthWorkout('x', [{ category: 'PLANK', sets: 2 }])).toThrow('exactly one of reps or holdSeconds');
    expect(() => buildStrengthWorkout('x', [{ category: 'PLANK', sets: 2, reps: 5, holdSeconds: 30 }])).toThrow('exactly one');
  });
});

describe('describeStrengthWorkout', () => {
  it('summarizes each exercise', () => {
    expect(describeStrengthWorkout(exercises)).toEqual([
      'barbell back squat: 3 x 6 at 60 lb, 1:30 rest',
      'dead bug: 2 x 8',
    ]);
  });

  it('summarizes a timed hold', () => {
    expect(describeStrengthWorkout([{ category: 'PLANK', exerciseName: 'SIDE_PLANK', sets: 4, holdSeconds: 30 }])).toEqual(['side plank: 4 x 30 s']);
  });
});
