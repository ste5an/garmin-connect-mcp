import { defineTool, gather } from './define';
import { clock, compact, kgFromGrams, label, pacePerKm, round } from './format';

type Raw = Record<string, any>;

const RECORD_LABELS: Record<number, string> = {
  1: 'fastest 1 km',
  2: 'fastest 1 mile',
  3: 'fastest 5K',
  4: 'fastest 10K',
  5: 'fastest half marathon',
  6: 'fastest marathon',
  7: 'longest run (m)',
  12: 'most steps in a day',
  13: 'most steps in a week',
  14: 'most steps in a month',
};

const TIME_RECORDS = new Set([1, 2, 3, 4, 5, 6]);

function ageFrom(birthDate: string | undefined): number | undefined {
  if (!birthDate) return undefined;
  const born = new Date(birthDate);
  const now = new Date();
  let age = now.getFullYear() - born.getUTCFullYear();
  if (now.getMonth() < born.getUTCMonth() || (now.getMonth() === born.getUTCMonth() && now.getDate() < born.getUTCDate())) age -= 1;
  return age;
}

export const profile = defineTool({
  name: 'profile',
  title: 'Profile, devices and records',
  description:
    'Who the athlete is and what they own: name, age, height, weight, VO2 max, lactate threshold, registered devices, gear (shoes, bikes), ' +
    'goals and personal records (fastest 1K/5K/10K, longest run, most steps).',
  input: {},
  run: async (_args, { client }) => {
    const { data, unavailable } = await gather({
      profile: () => client.getUserProfile(),
      settings: () => client.getUserSettings(),
      devices: () => client.getDevices(),
      gear: () => client.getGear(),
      goals: () => client.getGoals(),
      records: () => client.getPersonalRecords(),
    });
    const user = (data.settings as Raw | undefined)?.userData ?? {};
    return compact({
      name: (data.profile as Raw | undefined)?.fullName,
      age: ageFrom(user.birthDate),
      gender: user.gender?.toLowerCase(),
      heightCm: user.height,
      weightKg: kgFromGrams(user.weight),
      units: user.measurementSystem,
      vo2MaxRunning: user.vo2MaxRunning,
      lactateThreshold: {
        heartRate: user.lactateThresholdHeartRate,
        pacePerKm: user.lactateThresholdSpeed ? pacePerKm(user.lactateThresholdSpeed * 10) : undefined,
      },
      devices: ((data.devices as Raw[] | undefined) ?? []).map((device) => ({
        name: device.productDisplayName ?? device.deviceTypeSimpleName,
        status: device.deviceStatus,
      })),
      gear: ((data.gear as Raw[] | undefined) ?? []).map((item) => ({
        id: item.uuid,
        name: item.displayName ?? item.customMakeModel,
        type: label(item.gearTypeName),
        status: label(item.gearStatusName),
        maxKm: item.maximumMeter ? round(item.maximumMeter / 1000) : undefined,
      })),
      goals: data.goals,
      personalRecords: ((data.records as Raw[] | undefined) ?? [])
        .filter((record) => RECORD_LABELS[record.typeId])
        .map((record) => ({
          record: RECORD_LABELS[record.typeId],
          value: TIME_RECORDS.has(record.typeId) ? clock(record.value) : round(record.value),
          date: String(record.actStartDateTimeInGMTFormatted ?? '').slice(0, 10),
          activityId: record.activityId || undefined,
        })),
      unavailable,
    });
  },
});
