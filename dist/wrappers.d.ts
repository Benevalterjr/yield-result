import { Result } from "./types.js";
/**
 * Wraps a synchronous function that may throw an exception into a Result<T, E>.
 * Catches any thrown value and maps it using errorMapper if provided.
 */
export declare const fromThrowable: <T, E = unknown>(fn: () => T, errorMapper?: (e: unknown) => E) => Result<T, E>;
/**
 * Wraps a Promise into a Promise<Result<T, E>>.
 * Catches any rejection and maps it using errorMapper if provided.
 */
export declare const fromPromise: <T, E = unknown>(promise: Promise<T>, errorMapper?: (e: unknown) => E) => Promise<Result<T, E>>;
/**
 * Wraps an async function that returns a Promise into a Promise<Result<T, E>>.
 * Catches both synchronous exceptions thrown during execution and async rejections.
 */
export declare const fromAsyncFn: <T, E = unknown>(fn: () => Promise<T>, errorMapper?: (e: unknown) => E) => Promise<Result<T, E>>;
