import { z } from 'zod';
import { resolveDate } from './dates';
import { defineTool } from './define';

const MAX_WEIGHT_KG = 700;
const MAX_HYDRATION_ML = 20_000;

export const logWeight = defineTool({
  name: 'log_weight',
  title: 'Log weight',
  description: 'Record a weigh-in in Garmin Connect.',
  mode: 'write',
  input: {
    weight: z.number().positive().max(MAX_WEIGHT_KG).describe('Body weight.'),
    unit: z.enum(['kg', 'lbs']).optional().describe('Unit. Default kg.'),
    date: z.string().optional().describe('YYYY-MM-DD or "today". Default today.'),
  },
  run: async ({ weight, unit, date }, { client }) => {
    const day = resolveDate(date);
    await client.addWeighIn(weight, unit ?? 'kg', day);
    return { logged: `${weight} ${unit ?? 'kg'}`, date: day };
  },
});

export const logHydration = defineTool({
  name: 'log_hydration',
  title: 'Log hydration',
  description: 'Record water intake in milliliters.',
  mode: 'write',
  input: {
    ml: z.number().min(0).max(MAX_HYDRATION_ML).describe('Amount in milliliters.'),
    date: z.string().optional().describe('YYYY-MM-DD or "today". Default today.'),
  },
  run: async ({ ml, date }, { client }) => {
    const day = resolveDate(date);
    await client.setHydration(ml, day);
    return { logged: `${ml} ml`, date: day };
  },
});

export const logBloodPressure = defineTool({
  name: 'log_blood_pressure',
  title: 'Log blood pressure',
  description: 'Record a blood pressure reading.',
  mode: 'write',
  input: {
    systolic: z.number().positive().max(300).describe('Systolic pressure, mmHg.'),
    diastolic: z.number().positive().max(200).describe('Diastolic pressure, mmHg.'),
    pulse: z.number().positive().max(300).describe('Pulse, bpm.'),
    time: z.string().optional().describe('ISO 8601 timestamp. Default now.'),
    notes: z.string().optional().describe('Free-text note.'),
  },
  run: async ({ systolic, diastolic, pulse, time, notes }, { client }) => {
    await client.setBloodPressure(systolic, diastolic, pulse, time && new Date(time).toISOString(), notes);
    return { logged: `${systolic}/${diastolic} mmHg, pulse ${pulse}` };
  },
});

export const logActivity = defineTool({
  name: 'log_activity',
  title: 'Log manual activity',
  description: 'Create a manual activity entry, for example a gym session or a run recorded without the watch.',
  mode: 'write',
  input: {
    name: z.string().describe('Activity name, for example "Morning Run".'),
    type: z.string().describe('Activity type key such as running, cycling, strength_training, walking.'),
    start: z.string().describe('Start time as ISO 8601 with offset, for example 2026-10-21T07:30:00-04:00.'),
    minutes: z.number().positive().describe('Duration in minutes.'),
    distanceKm: z.number().min(0).optional().describe('Distance in kilometers.'),
  },
  run: async ({ name, type, start, minutes, distanceKm }, { client }) => {
    const startDate = new Date(start);
    if (Number.isNaN(startDate.getTime())) throw new Error(`Invalid start time "${start}".`);
    await client.createManualActivity({
      activityName: name,
      activityTypeKey: type,
      startTimeInGMT: startDate.toISOString().replace('Z', ''),
      elapsedDurationInSecs: Math.round(minutes * 60),
      distanceInMeters: distanceKm === undefined ? undefined : Math.round(distanceKm * 1000),
    });
    return { created: name };
  },
});

export const renameActivity = defineTool({
  name: 'rename_activity',
  title: 'Rename activity',
  description: 'Change the name of an activity.',
  mode: 'write',
  input: {
    id: z.number().int().describe('Activity id.'),
    name: z.string().min(1).describe('New name.'),
  },
  run: async ({ id, name }, { client }) => {
    await client.setActivityName(id, name);
    return { renamed: id, name };
  },
});

export const deleteActivity = defineTool({
  name: 'delete_activity',
  title: 'Delete activity',
  description: 'Permanently delete an activity from Garmin Connect. This cannot be undone. Only call after the user has confirmed.',
  mode: 'destructive',
  input: {
    id: z.number().int().describe('Activity id.'),
    confirm: z.literal(true).describe('Must be true. Set only after the user explicitly confirmed the deletion.'),
  },
  run: async ({ id }, { client }) => {
    await client.deleteActivity(id);
    return { deleted: id };
  },
});

export const assignGear = defineTool({
  name: 'assign_gear',
  title: 'Assign gear',
  description: 'Link gear (shoes, bike) to an activity, or unlink it. Gear ids are listed by `profile`.',
  mode: 'write',
  input: {
    activityId: z.number().int().describe('Activity id.'),
    gearId: z.string().describe('Gear uuid.'),
    action: z.enum(['add', 'remove']).optional().describe('Default add.'),
  },
  run: async ({ activityId, gearId, action }, { client }) => {
    if (action === 'remove') await client.removeGearFromActivity(gearId, activityId);
    else await client.addGearToActivity(gearId, activityId);
    return { activityId, gearId, action: action ?? 'add' };
  },
});
