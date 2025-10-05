# catch-async

A tiny, batteries-included async helper that wraps any promise-returning function with retries, timeouts, lifecycle hooks, and structured error handling. Ship robust async flows with a single call.

## Features

- ✅ Unified success/error/finally hooks with optional logging
- 🔁 Built-in retry control with backoff delays and custom retry predicates
- ⏱️ Optional timeout guard to abort slow promises
- 🧱 Error transformation plus typed return payloads
- 🪶 Zero runtime dependencies, fully typed, tree-shake friendly

## Installation

```bash
npm install catch-async
# or
pnpm add catch-async
# or
yarn add catch-async
```

## Quick start

```ts
import catchAsync from "catch-async";

const { result, error } = await catchAsync(
  async () => {
    const response = await fetch("https://api.example.com/data");
    if (!response.ok) throw new Error("Request failed");
    return response.json();
  },
  {
    retryCount: 2,
    retryDelayMs: 200,
    timeoutMs: 3000,
    onSuccess: (data) => console.log("loaded", data),
    onError: (err) => console.warn("retrying", err),
    logger: (err, attempts) => console.error(`[attempt ${attempts}]`, err),
  }
);

if (error) {
  // gracefully degrade
}
```

## Why catch-async?

Writing `try/catch` blocks gets complicated once you add retry logic, logging, and clean-up hooks. `catch-async` centralizes that boilerplate so your business logic stays lean.

## API reference

### `catchAsync<T>(asyncFn, options?)`

Executes `asyncFn` and resolves with a structured result, giving you both the value (when available) and the error (when not).

#### Parameters

- `asyncFn: () => Promise<T>` — The promise-producing function to execute. It runs at least once and is retried according to `retryCount`.
- `options?: CatchAsyncOptions<T>` — Fine-grained control over lifecycle behavior.

#### Return value

`Promise<CatchAsyncResult<T>>` where:

- `result: T | undefined` — Resolved value or the provided `defaultValue` when the error was swallowed.
- `error: unknown` — Last thrown error (after transformation) if execution failed.
- `attempts: number` — Total number of attempts performed.
- `retried: boolean` — Indicates whether at least one retry occurred.

### Options

| Option           | Type                                            | Default                              | Description                                                        |
| ---------------- | ----------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------ |
| `onSuccess`      | `(result: T) => void \| Promise<void>`          | —                                    | Runs after a successful attempt.                                   |
| `onError`        | `(error: unknown) => void \| Promise<void>`     | —                                    | Runs after each failed attempt.                                    |
| `onFinally`      | `() => void \| Promise<void>`                   | —                                    | Runs at the end of every attempt, similar to `finally`.            |
| `rethrow`        | `boolean`                                       | `false`                              | Rethrows the final error instead of resolving with `defaultValue`. |
| `defaultValue`   | `T`                                             | `undefined`                          | Value returned when errors are swallowed.                          |
| `logger`         | `(error: unknown, attempts: number) => void`    | —                                    | Receives the transformed error and attempt count for logging.      |
| `retryCount`     | `number`                                        | `0`                                  | Number of retries after the initial attempt.                       |
| `retryDelayMs`   | `number`                                        | `0`                                  | Delay between retries in milliseconds.                             |
| `timeoutMs`      | `number`                                        | —                                    | Maximum time per attempt before timing out.                        |
| `transformError` | `(error: unknown) => unknown`                   | —                                    | Normalize/augment errors before they’re surfaced.                  |
| `shouldRetry`    | `(error: unknown, attempts: number) => boolean` | defaults to `attempts <= retryCount` | Fine-tune retry behavior dynamically.                              |

### `catchAsyncValue`

A tiny convenience wrapper that mirrors the legacy signature and returns only the successful value (or `undefined`). Prefer `catchAsync` when you need richer context.

```ts
import { catchAsyncValue } from "catch-async";

const user = await catchAsyncValue(fetchUser, { defaultValue: anonymousUser });
```

## Advanced usage

### Custom retry predicate

```ts
await catchAsync(fetchInvoice, {
  retryCount: 5,
  shouldRetry: (error, attempts) => {
    if (error instanceof HttpError && error.status >= 500) return true;
    return attempts <= 2; // allow two best-effort retries for other errors
  },
});
```

### Timeout guard

```ts
const { error } = await catchAsync(() => fetchSlowResource(), {
  timeoutMs: 2000,
  defaultValue: fallbackData,
});

if (error) {
  console.warn("Timed out — using fallback");
}
```

## TypeScript tips

- `catchAsync` is fully generic, inferring `T` from your async function.
- Compose `CatchAsyncOptions<T>` to build reusable configs.
- Use `CatchAsyncResult<T>` when you need to narrow on `result` or `error` in your code.

```ts
import type { CatchAsyncResult } from "catch-async";

type UserResult = CatchAsyncResult<User>;
```

## Contributing

1. Fork the repo and create a feature branch.
2. Install dependencies with `npm install`.
3. Run `npm test` to ensure the suite is green.
4. Follow the lint and formatting rules (`npm run lint`, `npm run format`).
5. Submit a pull request with a clear description.

## License

MIT © Shakeeb
