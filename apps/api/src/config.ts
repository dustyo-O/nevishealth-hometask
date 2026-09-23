export const API_CONFIG = Symbol('API_CONFIG');

export type ApiConfig = {
  port: number;
  devSwitches: {
    /** `?delay=` / `?fail=1` are honoured only outside production (tech doc D-5). */
    enabled: boolean;
    maxDelayMs: number;
  };
  /** `false` disables CORS entirely (production is same-origin). */
  corsOrigin: string | false;
};

const DEFAULT_PORT = 3000;

const parsePort = (raw: string | undefined): number => {
  const port = Number.parseInt(raw ?? '', 10);
  return Number.isInteger(port) && port >= 0 && port <= 65_535 ? port : DEFAULT_PORT;
};

/** Pure: reads only the given env so tests can pass their own. */
export const loadConfig = (env: NodeJS.ProcessEnv): ApiConfig => {
  const isProduction = env.NODE_ENV === 'production';
  return {
    port: parsePort(env.PORT),
    devSwitches: { enabled: !isProduction, maxDelayMs: 30_000 },
    corsOrigin: isProduction ? false : 'http://localhost:5173',
  };
};
