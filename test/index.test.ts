import { describe, expect, it, vi } from 'vitest';

import catchAsync, { CatchAsyncResult, } from '../src/index.js';

describe('catchAsync', () => {
  it('returns result on success and triggers onSuccess', async () => {
    const onSuccess = vi.fn();

    const result: CatchAsyncResult<string> = await catchAsync(async () => {
      await Promise.resolve();
      return 'ok';
    }, { onSuccess });

    expect(result.result).toBe('ok');
    expect(result.error).toBeUndefined();
    expect(result.attempts).toBe(1);
    expect(onSuccess).toHaveBeenCalledWith('ok');
  });

  it('returns default value when error is swallowed', async () => {
    const onError = vi.fn();
    const defaultValue = 'fallback';

    const result = await catchAsync(async () => {
      await Promise.resolve();
      throw new Error('fail');
    }, { defaultValue, onError });

    expect(result.result).toBe(defaultValue);
    expect(result.error).toBeInstanceOf(Error);
    expect(onError).toHaveBeenCalled();
  });

  it('transforms errors and logs attempts', async () => {
    const logger = vi.fn();

    const result = await catchAsync(async () => {
      await Promise.resolve();
      throw new Error('raw');
    }, {
      retryCount: 1,
      transformError: (error: unknown) => {
        if (error instanceof Error) return new Error(`wrapped:${error.message}`);
        return error;
      },
      logger,
      defaultValue: 'x',
    });

    expect(logger).toHaveBeenCalledTimes(2);
    const loggedError: unknown = logger.mock.calls[0]?.[0];
    expect(loggedError).toBeInstanceOf(Error);
    if (loggedError instanceof Error) {
      expect(loggedError.message).toBe('wrapped:raw');
    }

    expect(result.error).toBeInstanceOf(Error);
    if (result.error instanceof Error) {
      expect(result.error.message).toBe('wrapped:raw');
    }
  });

  it('rethrows when rethrow option is true', async () => {
    await expect(
      catchAsync(async () => {
        await Promise.resolve();
        throw new Error('boom');
      }, { rethrow: true })
    ).rejects.toThrow('boom');
  });

  it('retries the configured number of times', async () => {
    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('success');

    const onError = vi.fn();

    const result = await catchAsync(asyncFn, {
      retryCount: 2,
      onError,
    });

    expect(asyncFn).toHaveBeenCalledTimes(3);
    expect(onError).toHaveBeenCalledTimes(2);
    expect(result.result).toBe('success');
    expect(result.retried).toBe(true);
  });

  it('aborts when timeout is exceeded', async () => {
    const promise = catchAsync(
      () =>
        new Promise((resolve) => {
          setTimeout(() => resolve('slow'), 30);
        }),
      { timeoutMs: 5 }
    );

    const { error, result } = await promise;
    expect(result).toBeUndefined();
    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).toMatch(/timed out/);
  });

  it('allows custom retry predicate', async () => {
    const asyncFn = vi
      .fn()
      .mockRejectedValueOnce(new Error('first'))
      .mockRejectedValueOnce(new Error('second'))
      .mockResolvedValue('success');

    const result = await catchAsync(asyncFn, {
      retryCount: 5,
      shouldRetry: (error: unknown, attempts: number) => {
        if (error instanceof Error && error.message === 'second') {
          return false;
        }
        return attempts <= 2;
      },
    });

    expect(asyncFn).toHaveBeenCalledTimes(2);
    expect(result.result).toBeUndefined();
    expect(result.error).toBeInstanceOf(Error);
  });

  it('invokes lifecycle hooks in order', async () => {
    const events: string[] = [];

    const result = await catchAsync(async () => {
      await Promise.resolve();
      events.push('fn');
      return 123;
    }, {
      onSuccess: (value: number) => {
        events.push(`success:${value}`);
      },
      onError: () => {
        events.push('error');
      },
      onFinally: () => {
        events.push('finally');
      },
    });

    expect(result.result).toBe(123);
    expect(events).toEqual(['fn', 'success:123', 'finally']);
  });
});


