import { z } from 'zod';
import { defineTool } from './define';
import { isRedactionEnabled, redactPersonalFields } from './redact';

const ALLOWED_PREFIX = /^\/[a-z0-9-]+-service\//i;

export const garminApi = defineTool({
  name: 'garmin_api',
  title: 'Raw Garmin API (read-only)',
  description:
    'Escape hatch: GET any Garmin Connect API path (for example /wellness-service/wellness/dailyHeartRate/<displayName>?date=2026-10-21) ' +
    'when no other tool covers a metric. Returns unprocessed JSON, which can be large. Names, ids, emails and GPS coordinates are redacted unless GARMIN_RAW_UNREDACTED=1 is set in the server env. Prefer the other tools.',
  input: {
    path: z.string().describe('Path starting with /, for example /usersummary-service/usersummary/daily/<displayName>?calendarDate=2026-10-21.'),
  },
  run: async ({ path }, { client }) => {
    if (!ALLOWED_PREFIX.test(path)) throw new Error('Path must look like /something-service/...');
    const data = await client.get(path);
    return isRedactionEnabled() ? redactPersonalFields(data) : data;
  },
});
