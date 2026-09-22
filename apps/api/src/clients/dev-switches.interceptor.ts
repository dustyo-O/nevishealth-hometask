import {
  Inject,
  Injectable,
  InternalServerErrorException,
  type CallHandler,
  type ExecutionContext,
  type NestInterceptor,
} from '@nestjs/common';
import type { Request } from 'express';
import type { Observable } from 'rxjs';
import { API_CONFIG, type ApiConfig } from '../config.js';

const sleep = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** `?delay=` as whole milliseconds in `[0, maxDelayMs]`; anything that is not a non-negative number → 0. */
export const clampDelay = (raw: unknown, maxDelayMs: number): number => {
  if (typeof raw !== 'string') return 0;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed < 0) return 0;
  return Math.min(parsed, maxDelayMs);
};

/**
 * The demonstration switches `?delay=<ms>` and `?fail=1` (spec 001 FR2, tech doc D-5): wait for the
 * delay, then fail if asked. Bound on `ClientsController` only — health stays instant. Outside
 * development the request is handed on before the query is even looked at, so a production build
 * treats the switches as any other unknown parameter.
 */
@Injectable()
export class DevSwitchesInterceptor implements NestInterceptor {
  constructor(@Inject(API_CONFIG) private readonly config: ApiConfig) {}

  async intercept(context: ExecutionContext, next: CallHandler): Promise<Observable<unknown>> {
    const { enabled, maxDelayMs } = this.config.devSwitches;
    if (!enabled) return next.handle();

    const { query } = context.switchToHttp().getRequest<Request>();
    const delay = clampDelay(query.delay, maxDelayMs);
    if (delay > 0) await sleep(delay);
    if (query.fail === '1') throw new InternalServerErrorException('Failing on purpose (?fail=1)');
    return next.handle();
  }
}
