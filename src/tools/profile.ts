import { defineTool, gather } from './define';
import { compact } from './format';

type Raw = Record<string, any>;

export const profile = defineTool({
  name: 'profile',
  title: 'Profile and heart-rate zones',
  description:
    'Account settings (units, time zone), heart-rate zones per sport with max, resting and lactate threshold heart rate, and fitness age.',
  input: {},
  run: async (_args, { client }) => {
    const { data, unavailable } = await gather({
      settings: () => client.getUserSettings(),
      zones: () => client.getHeartRateZones(),
      fitnessAge: () => client.getFitnessAge(),
    });
    const settings = data.settings as Raw | undefined;
    const fitnessAge = data.fitnessAge as Raw | undefined;
    return compact({
      units: settings?.measurementSystem,
      timeZone: settings?.timeZone,
      heartRateZones: ((data.zones as Raw[] | undefined) ?? []).map((zone) => ({
        sport: zone.sport?.toLowerCase(),
        method: zone.trainingMethod?.toLowerCase(),
        maxHr: zone.maxHeartRateUsed,
        restingHr: zone.restingHeartRateUsed,
        lactateThresholdHr: zone.lactateThresholdHeartRateUsed,
        zoneFloors: [zone.zone1Floor, zone.zone2Floor, zone.zone3Floor, zone.zone4Floor, zone.zone5Floor],
      })),
      fitnessAge: fitnessAge && {
        chronological: fitnessAge.chronologicalAge,
        fitness: fitnessAge.fitnessAge,
        previous: fitnessAge.previousFitnessAge,
      },
      unavailable,
    });
  },
});
