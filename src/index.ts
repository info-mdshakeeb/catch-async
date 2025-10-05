/**
 * Enhanced async wrapper for unified error handling, logging, and control flow.
 */
export interface CatchAsyncOptions<T> {
  /** Callback executed when the async function resolves successfully. */
  onSuccess?: (result: T) => Promise<void> | void;
  /** Callback executed when the async function throws or rejects. */
  onError?: (error: unknown) => Promise<void> | void;
  /** Callback executed after success or failure (similar to `finally`). */
  onFinally?: () => Promise<void> | void;
  /** When true, rethrow the final error instead of returning `defaultValue`. */
  rethrow?: boolean;
  /** Value to resolve with when an error is swallowed. */
  defaultValue?: T;
  /** Logger invoked with the transformed error. */
  logger?: (error: unknown, attempts: number) => void;
  /** Number of retries to attempt after the initial failure. */
  retryCount?: number;
  /** Delay in milliseconds between retry attempts. */
  retryDelayMs?: number;
  /** Abort execution if the async function takes longer than the configured timeout. */
  timeoutMs?: number;
  /** Transform or normalize the error before it is logged/handled. */
  transformError?: (error: unknown) => unknown;
  /** Predicate to determine whether an error is retryable. */
  shouldRetry?: (error: unknown, attempts: number) => boolean;
}

export interface CatchAsyncResult<T> {
  /** Either the successful result or the default value when provided. */
  result: T | undefined;
  /** The captured error, if any. */
  error: unknown;
  /** Total number of attempts performed. */
  attempts: number;
  /** True when the result came from a retry (i.e., attempts > 1). */
  retried: boolean;
}

const delay = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

const withTimeout = async <T>(fn: () => Promise<T>, timeoutMs?: number): Promise<T> => {
  if (!timeoutMs) return fn();
  return Promise.race([
    fn(),
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error(`Async function timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
};

/**
 * Execute an async function with enhanced error handling, retries, and lifecycle hooks.
 */
export async function catchAsync<T>(
  asyncFn: () => Promise<T>,
  options: CatchAsyncOptions<T> = {}
): Promise<CatchAsyncResult<T>> {
  const {
    onSuccess,
    onError,
    onFinally,
    rethrow = false,
    defaultValue,
    logger,
    retryCount = 0,
    retryDelayMs = 0,
    timeoutMs,
    transformError,
    shouldRetry,
  } = options;

  if (retryCount < 0) throw new Error("retryCount cannot be negative");
  if (retryDelayMs < 0) throw new Error("retryDelayMs cannot be negative");
  if (timeoutMs !== undefined && timeoutMs <= 0) throw new Error("timeoutMs must be greater than 0");

  let attempts = 0;

  for (; ;) {
    attempts += 1;

    try {
      const result = await withTimeout(asyncFn, timeoutMs);
      await onSuccess?.(result);
      return { result, error: undefined, attempts, retried: attempts > 1 };
    } catch (rawErr) {
      const error = transformError ? transformError(rawErr) : rawErr;
      logger?.(error, attempts);
      await onError?.(error);

      const hasRetriesRemaining = attempts <= retryCount;
      const isRetryable = shouldRetry ? shouldRetry(error, attempts) : hasRetriesRemaining;

      if (hasRetriesRemaining && isRetryable) {
        if (retryDelayMs > 0) await delay(retryDelayMs);
        continue;
      }

      if (rethrow) throw error;
      return { result: defaultValue, error, attempts, retried: attempts > 1 };
    } finally {
      await onFinally?.();
    }
  }
}

export default catchAsync;
