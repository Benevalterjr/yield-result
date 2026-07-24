import { Result, Err } from "./types.js";
/**
 * Control flow runners for evaluating generator functions with short-circuiting on Err.
 */
export declare const safe: {
    /**
     * Evaluates a synchronous generator function, returning Ok(value) on completion,
     * or short-circuiting on the first yielded Err(error).
     */
    sync: <T, E = unknown>(fn: () => Generator<Err<E>, T, unknown>) => Result<T, E>;
    /**
     * Evaluates an async generator function, returning Ok(value) on completion,
     * or short-circuiting on the first yielded Err(error).
     */
    async: <T, E = unknown>(fn: () => AsyncGenerator<Err<E>, T, unknown>) => Promise<Result<T, E>>;
};
