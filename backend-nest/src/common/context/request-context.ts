import { AsyncLocalStorage } from 'async_hooks';

export interface RequestContext {
  traceId: string;
  userId?: string;
  orgId?: string;
}

/**
 * AsyncLocalStorage that propagates the current request's context
 * (traceId, userId, orgId) through all async operations — database
 * calls, service methods, etc. — without manually threading it.
 *
 * Set by LoggingInterceptor at the start of each request.
 * Read by AppLogger to automatically attach traceId to every log entry.
 */
export const requestContextStorage = new AsyncLocalStorage<RequestContext>();
