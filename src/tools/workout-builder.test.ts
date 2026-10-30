import { describe, expect, it } from 'vitest';
import { buildRunWorkout, describeRunWorkout, paceToSpeed, type RunWorkoutStep } from './workout-builder';

const sixByThree: RunWorkoutStep[] = [
  { type: 'warmup', seconds: 600 },
  {
    repeat: 6,
    steps: [
      { type: 'work', seconds: 180, fastPace: '4:20', slowPace: '4:30' },
      { type: 'recovery', seconds: 120 },
    ],
  },
  { type: 'cooldown', seconds: 600 },
];

describe('paceToSpeed', () => {
  it('converts min/km to meters per second', () => {
    expect(paceToSpeed('4:25')).toBe(3.774);
    expect(paceToSpeed('5:00')).toBe(3.333);
  });

  it('rejects text that is not a pace', () => {
    expect(() => paceToSpeed('fast')).toThrow('4:25');
    expect(() => paceToSpeed('4:75')).toThrow('4:25');
    expect(() => paceToSpeed('0:00')).toThrow('above 0:00');
  });
});

describe('buildRunWorkout', () => {
  const workout = buildRunWorkout('6x3 VO2', sixByThree);
  const segment = workout.workoutSegments[0];

  it('wraps the steps in a single running segment', () => {
    expect(workout.workoutName).toBe('6x3 VO2');
    expect(workout.sportType.sportTypeKey).toBe('running');
    expect(segment.workoutSteps).toHaveLength(3);
  });

  it('numbers steps in order including those inside a repeat', () => {
    const [warmup, group, cooldown] = segment.workoutSteps;
    expect(warmup.stepOrder).toBe(1);
    expect(group.stepOrder).toBe(2);
    expect(group.workoutSteps.map((step: any) => step.stepOrder)).toEqual([3, 4]);
    expect(cooldown.stepOrder).toBe(5);
  });

  it('builds the repeat group with iterations', () => {
    const group = segment.workoutSteps[1];
    expect(group.type).toBe('RepeatGroupDTO');
    expect(group.numberOfIterations).toBe(6);
    expect(group.endCondition.conditionTypeKey).toBe('iterations');
    expect(group.endConditionValue).toBe(6);
  });

  it('sets a pace target with the slow speed first', () => {
    const work = segment.workoutSteps[1].workoutSteps[0];
    expect(work.stepType.stepTypeKey).toBe('interval');
    expect(work.endCondition.conditionTypeKey).toBe('time');
    expect(work.endConditionValue).toBe(180);
    expect(work.targetType.workoutTargetTypeKey).toBe('pace.zone');
    expect(work.targetValueOne).toBe(paceToSpeed('4:30'));
    expect(work.targetValueTwo).toBe(paceToSpeed('4:20'));
  });

  it('leaves steps without a pace untargeted and supports distance', () => {
    const distance = buildRunWorkout('1k', [{ type: 'work', meters: 1000 }]).workoutSegments[0].workoutSteps[0];
    expect(distance.endCondition.conditionTypeKey).toBe('distance');
    expect(distance.endConditionValue).toBe(1000);
    expect(distance.targetType.workoutTargetTypeKey).toBe('no.target');
  });

  it('rejects a step with both or neither of seconds and meters', () => {
    expect(() => buildRunWorkout('x', [{ type: 'work' }])).toThrow('exactly one of seconds or meters');
    expect(() => buildRunWorkout('x', [{ type: 'work', seconds: 60, meters: 200 }])).toThrow('exactly one');
  });

  it('rejects a half pace target and a reversed range', () => {
    expect(() => buildRunWorkout('x', [{ type: 'work', seconds: 60, fastPace: '4:20' }])).toThrow('both fastPace and slowPace');
    expect(() => buildRunWorkout('x', [{ type: 'work', seconds: 60, fastPace: '4:40', slowPace: '4:20' }])).toThrow('slower than');
  });
});

describe('describeRunWorkout', () => {
  it('summarizes steps and repeats', () => {
    expect(describeRunWorkout(sixByThree)).toEqual([
      '10:00 warmup',
      '6 x [3:00 work at 4:20-4:30/km, 2:00 recovery]',
      '10:00 cooldown',
    ]);
  });
});
