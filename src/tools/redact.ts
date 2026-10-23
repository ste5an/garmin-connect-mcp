const PERSONAL_KEY =
  /^(displayName|fullName|userName|firstName|lastName|ownerFullName|ownerDisplayName|email|emailAddress|birthDate|userProfilePK|userProfileId|userProfileNumber|ownerId|profileImage\w*|ownerProfileImage\w*|latitude|longitude|startLatitude|startLongitude|endLatitude|endLongitude|minLatitude|maxLatitude|minLongitude|maxLongitude|locationName|serialNumber|deviceId|unitId|phoneNumber|address\w*)$/i;

export const REDACTED = '[redacted]';

export function redactPersonalFields(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactPersonalFields);
  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, inner]) => [
        key,
        PERSONAL_KEY.test(key) && inner != null ? REDACTED : redactPersonalFields(inner),
      ]),
    );
  }
  return value;
}

export function isRedactionEnabled(env: NodeJS.ProcessEnv = process.env): boolean {
  return env.GARMIN_RAW_UNREDACTED !== '1';
}
