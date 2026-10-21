import { defineTool, gather } from './define';
import { addDays, resolveDate } from './dates';
import { clock, compact, pacePerKm, round } from './format';
import { summarizeTrainingStatus } from './summaries';

type Raw = Record<string, any>;

const ENDURANCE_LEVELS = [
  ['recreational', 0],
  ['intermediate', 'classificationLowerLimitIntermediate'],
  ['trained', 'classificationLowerLimitTrained'],
  ['well trained', 'classificationLowerLimitWellTrained'],
  ['expert', 'classificationLowerLimitExpert'],
  ['superior', 'classificationLowerLimitSuperior'],
  ['elite', 'classificationLowerLimitElite'],
] as const;

function enduranceLevel(dto: Raw): string | undefined {
  let level: string | undefined;
  for (const [name, key] of ENDURANCE_LEVELS) {
    const limit = key === 0 ? 0 : dto[key];
    if (typeof limit === 'number' && dto.overallScore >= limit) level = name;
  }
  return level;
}

export const training = defineTool({
  name: 'training',
  title: 'Training and fitness',
  description:
    'Current fitness picture: training status, acute/chronic load and balance, VO2 max, race time predictions (5K to marathon), ' +
    'endurance and hill scores, lactate threshold and fitness age.',
  input: {},
  run: async (_args, { client }) => {
    const today = resolveDate();
    const { data, unavailable } = await gather({
      status: () => client.getTrainingStatus(today),
      races: () => client.getRacePredictions(),
      endurance: () => client.getEnduranceScore(addDays(today, -7), today),
      hill: () => client.getHillScore(addDays(today, -7), today),
      lactate: () => client.getLactateThreshold(),
      ftp: () => client.getCyclingFTP(),
      fitnessAge: () => client.getFitnessAge(today),
    });
    const races = data.races as Raw | undefined;
    const endurance = (data.endurance as Raw | undefined)?.enduranceScoreDTO;
    const hill = ((data.hill as Raw | undefined)?.hillScoreDTOList as Raw[] | undefined)?.at(-1);
    const lactate = data.lactate as Raw[] | undefined;
    const lactateSpeed = lactate?.find((entry) => entry.speed)?.speed;
    const ftp = data.ftp as Raw | undefined;
    const fitnessAge = data.fitnessAge as Raw | undefined;
    return compact({
      ...summarizeTrainingStatus(data.status as any),
      racePredictions: races && {
        '5K': clock(races.time5K),
        '10K': clock(races.time10K),
        halfMarathon: clock(races.timeHalfMarathon),
        marathon: clock(races.timeMarathon),
      },
      enduranceScore: endurance && { score: endurance.overallScore, level: enduranceLevel(endurance) },
      hillScore: hill && { overall: hill.overallScore, strength: hill.strengthScore, endurance: hill.enduranceScore },
      lactateThreshold: lactate && {
        heartRate: lactate.find((entry) => entry.hearRate)?.hearRate,
        pacePerKm: lactateSpeed ? pacePerKm(lactateSpeed * 10) : undefined,
      },
      cyclingFtpW: ftp?.functionalThresholdPower,
      fitnessAge: fitnessAge && {
        years: round(fitnessAge.fitnessAge, 1),
        actualAge: fitnessAge.chronologicalAge,
        achievable: round(fitnessAge.achievableFitnessAge, 1),
      },
      unavailable,
    });
  },
});
