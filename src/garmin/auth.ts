import axios from 'axios';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DEFAULT_BASE_URL = 'https://personal.connectapi.garmin.com';
const TOKEN_PATH = '/personalapitoken-service/personal-api/personal-api-key/token';
const KEY_PAGE = 'https://connect.garmin.com/app/settings/personalApiToken';

const DEFAULT_KEY_FILE = path.join(os.homedir(), '.config', 'garmin', 'connect-personal-api-key');
const TOKEN_DIR = path.join(os.homedir(), '.garmin-mcp');
const TOKEN_CACHE_FILE = 'personal-api-token.json';

const REQUEST_TIMEOUT_MS = 30_000;
const MAX_REQUEST_RETRIES = 3;
const TOKEN_REFRESH_WINDOW_SECONDS = 60 * 60;

type CachedToken = {
  fingerprint: string;
  access_token: string;
  expires_at: number;
};

export class AuthRequiredError extends Error {
  constructor(detail: string) {
    super(`${detail} Create a key at ${KEY_PAGE}, then run \`npx garmin-connect-mcp setup\`.`);
    this.name = 'AuthRequiredError';
  }
}

export type QueryParams = Record<string, string | number | boolean>;

export function keyFilePath(env: NodeJS.ProcessEnv = process.env): string {
  return env.GARMIN_PERSONAL_API_KEY_FILE ?? DEFAULT_KEY_FILE;
}

export function baseUrl(env: NodeJS.ProcessEnv = process.env): string {
  return (env.GARMIN_PERSONAL_API_BASE_URL ?? DEFAULT_BASE_URL).replace(/\/+$/, '');
}

function jwtExpiry(token: string): number {
  try {
    const payload = token.split('.')[1] ?? '';
    const claims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as { exp?: unknown };
    if (typeof claims.exp === 'number') return claims.exp;
  } catch {
  }
  throw new Error('Garmin token endpoint did not return a JWT with an exp claim.');
}

export class GarminAuth {
  private readonly base = baseUrl();
  private readonly keyFile = keyFilePath();
  private token: CachedToken | null = null;

  constructor() {
    this.token = this.readCache();
  }

  private readKey(): string {
    let key: string;
    try {
      key = fs.readFileSync(this.keyFile, 'utf-8').trim();
    } catch {
      throw new AuthRequiredError(`No Garmin Personal API key found at ${this.keyFile}.`);
    }
    if (!key) throw new AuthRequiredError(`The Garmin Personal API key file ${this.keyFile} is empty.`);
    return key;
  }

  private fingerprint(key: string): string {
    return crypto.createHash('sha256').update(`${this.base}\0${key}`).digest('hex');
  }

  private isFresh(token: CachedToken | null, fingerprint: string): token is CachedToken {
    return (
      token !== null &&
      token.fingerprint === fingerprint &&
      token.expires_at - Date.now() / 1000 > TOKEN_REFRESH_WINDOW_SECONDS
    );
  }

  async connect(): Promise<void> {
    await this.accessToken();
  }

  private async accessToken(forceRefresh = false): Promise<string> {
    const key = this.readKey();
    const fingerprint = this.fingerprint(key);
    if (!forceRefresh && this.isFresh(this.token, fingerprint)) return this.token.access_token;

    const response = await axios.post<string>(`${this.base}${TOKEN_PATH}`, null, {
      headers: { Accept: '*/*', Authorization: `ApiKey ${key}` },
      responseType: 'text',
      timeout: REQUEST_TIMEOUT_MS,
    });
    const accessToken = String(response.data).trim();
    this.token = { fingerprint, access_token: accessToken, expires_at: jwtExpiry(accessToken) };
    this.writeCache(this.token);
    return accessToken;
  }

  async get<T>(endpoint: string, params?: QueryParams): Promise<T> {
    let accessToken = await this.accessToken();

    for (let attempt = 0; attempt <= MAX_REQUEST_RETRIES; attempt++) {
      try {
        const response = await axios.get<T>(`${this.base}${endpoint}`, {
          headers: { Accept: 'application/json', Authorization: `Bearer ${accessToken}` },
          params,
          timeout: REQUEST_TIMEOUT_MS,
        });
        return response.data;
      } catch (error: unknown) {
        if (!axios.isAxiosError(error)) throw error;
        const status = error.response?.status;

        if (status === 401 && attempt === 0) {
          accessToken = await this.accessToken(true);
          continue;
        }

        if ((status === 429 || (status && status >= 500)) && attempt < MAX_REQUEST_RETRIES) {
          await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
          continue;
        }

        throw error;
      }
    }

    throw new Error('Max retries exceeded');
  }

  private readCache(): CachedToken | null {
    try {
      const cached = JSON.parse(fs.readFileSync(path.join(TOKEN_DIR, TOKEN_CACHE_FILE), 'utf-8')) as CachedToken;
      if (typeof cached.access_token === 'string' && typeof cached.expires_at === 'number') return cached;
    } catch {
    }
    return null;
  }

  private writeCache(token: CachedToken): void {
    try {
      fs.mkdirSync(TOKEN_DIR, { recursive: true, mode: 0o700 });
      fs.writeFileSync(path.join(TOKEN_DIR, TOKEN_CACHE_FILE), JSON.stringify(token), { mode: 0o600 });
    } catch {
    }
  }

  clearCache(): void {
    this.token = null;
    fs.rmSync(path.join(TOKEN_DIR, TOKEN_CACHE_FILE), { force: true });
  }
}
