import { z } from 'zod';
import { clock } from './format';

type Raw = Record<string, any>;

const STEP_TYPES = {
  warmup: { stepTypeId: 1, stepTypeKey: 'warmup' },
  cooldown: { stepTypeId: 2, stepTypeKey: 'cooldown' },
  work: { stepTypeId: 3, stepTypeKey: 'interval' },
  recovery: { stepTypeId: 4, stepTypeKey: 'recovery' },
  rest: { stepTypeId: 5, stepTypeKey: 'rest' },
} as const;

const REPEAT_STEP_TYPE = { stepTypeId: 6, stepTypeKey: 'repeat' };
const RUNNING = { sportTypeId: 1, sportTypeKey: 'running' };
const TIME_CONDITION = { conditionTypeId: 2, conditionTypeKey: 'time' };
const DISTANCE_CONDITION = { conditionTypeId: 3, conditionTypeKey: 'distance' };
const ITERATIONS_CONDITION = { conditionTypeId: 7, conditionTypeKey: 'iterations' };
const NO_TARGET = { workoutTargetTypeId: 1, workoutTargetTypeKey: 'no.target' };
const PACE_TARGET = { workoutTargetTypeId: 6, workoutTargetTypeKey: 'pace.zone' };
const PACE_PATTERN = /^(\d{1,2}):([0-5]\d)$/;

export const runStepSchema = z.object({
  type: z.enum(['warmup', 'work', 'recovery', 'cooldown', 'rest']).describe('Role of the step.'),
  seconds: z.number().int().min(5).max(21_600).optional().describe('Duration in seconds. Give seconds or meters.'),
  meters: z.number().int().min(50).max(100_000).optional().describe('Distance in meters. Give seconds or meters.'),
  fastPace: z.string().optional().describe('Fast end of the pace target as m:ss per km, for example 4:20. Give with slowPace.'),
  slowPace: z.string().optional().describe('Slow end of the pace target as m:ss per km, for example 4:30. Give with fastPace.'),
});

export const runRepeatSchema = z.object({
  repeat: z.number().int().min(2).max(50).describe('How many times to run the steps.'),
  steps: z.array(runStepSchema).min(1).max(10),
});

export const runWorkoutStepsSchema = z.array(z.union([runStepSchema, runRepeatSchema])).min(1).max(20);

export type RunStep = z.infer<typeof runStepSchema>;
export type RunRepeat = z.infer<typeof runRepeatSchema>;
export type RunWorkoutStep = RunStep | RunRepeat;

function isRepeat(step: RunWorkoutStep): step is RunRepeat {
  return 'repeat' in step;
}

export function paceToSpeed(pace: string): number {
  const match = PACE_PATTERN.exec(pace.trim());
  if (!match) throw new Error(`Pace "${pace}" must look like 4:25 (minutes:seconds per km).`);
  const seconds = Number(match[1]) * 60 + Number(match[2]);
  if (seconds === 0) throw new Error('Pace must be above 0:00.');
  return Math.round((1000 / seconds) * 1000) / 1000;
}

function buildEndCondition(step: RunStep): Raw {
  const hasSeconds = step.seconds !== undefined;
  const hasMeters = step.meters !== undefined;
  if (hasSeconds === hasMeters) throw new Error(`The ${step.type} step needs exactly one of seconds or meters.`);
  return hasSeconds
    ? { endCondition: TIME_CONDITION, endConditionValue: step.seconds }
    : { endCondition: DISTANCE_CONDITION, endConditionValue: step.meters };
}

function buildTarget(step: RunStep): Raw {
  if (step.fastPace === undefined && step.slowPace === undefined) return { targetType: NO_TARGET };
  if (step.fastPace === undefined || step.slowPace === undefined) {
    throw new Error(`The ${step.type} step needs both fastPace and slowPace for a pace target.`);
  }
  const fast = paceToSpeed(step.fastPace);
  const slow = paceToSpeed(step.slowPace);
  if (fast < slow) throw new Error(`The ${step.type} step has fastPace ${step.fastPace} slower than slowPace ${step.slowPace}.`);
  return { targetType: PACE_TARGET, targetValueOne: slow, targetValueTwo: fast };
}

function buildStep(step: RunStep, stepOrder: number): Raw {
  return {
    type: 'ExecutableStepDTO',
    stepOrder,
    stepType: STEP_TYPES[step.type],
    ...buildEndCondition(step),
    ...buildTarget(step),
  };
}

export function buildRunWorkout(workoutName: string, steps: RunWorkoutStep[]): Raw {
  let order = 0;
  const build = (list: RunWorkoutStep[]): Raw[] =>
    list.map((step) => {
      order += 1;
      if (!isRepeat(step)) return buildStep(step, order);
      const stepOrder = order;
      return {
        type: 'RepeatGroupDTO',
        stepOrder,
        stepType: REPEAT_STEP_TYPE,
        numberOfIterations: step.repeat,
        endCondition: ITERATIONS_CONDITION,
        endConditionValue: step.repeat,
        workoutSteps: step.steps.map((child) => {
          order += 1;
          return buildStep(child, order);
        }),
      };
    });

  return {
    workoutName,
    sportType: RUNNING,
    workoutSegments: [{ segmentOrder: 1, sportType: RUNNING, workoutSteps: build(steps) }],
  };
}

function describeStep(step: RunStep): string {
  const size = step.seconds !== undefined ? clock(step.seconds) : `${step.meters} m`;
  const target = step.fastPace && step.slowPace ? ` at ${step.fastPace}-${step.slowPace}/km` : '';
  return `${size} ${step.type}${target}`;
}

export function describeRunWorkout(steps: RunWorkoutStep[]): string[] {
  return steps.map((step) =>
    isRepeat(step) ? `${step.repeat} x [${step.steps.map(describeStep).join(', ')}]` : describeStep(step),
  );
}
