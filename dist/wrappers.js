import { ok, err } from "./types.js";
/**
 * Wraps a synchronous function that may throw an exception into a Result<T, E>.
 * Catches any thrown value and maps it using errorMapper if provided.
 */
export const fromThrowable = (fn, errorMapper) => {
    try {
        return ok(fn());
    }
    catch (e) {
        return err(errorMapper ? errorMapper(e) : e);
    }
};
/**
 * Wraps a Promise into a Promise<Result<T, E>>.
 * Catches any rejection and maps it using errorMapper if provided.
 */
export const fromPromise = async (promise, errorMapper) => {
    try {
        const data = await promise;
        return ok(data);
    }
    catch (e) {
        return err(errorMapper ? errorMapper(e) : e);
    }
};
/**
 * Wraps an async function that returns a Promise into a Promise<Result<T, E>>.
 * Catches both synchronous exceptions thrown during execution and async rejections.
 */
export const fromAsyncFn = async (fn, errorMapper) => {
    try {
        const promise = fn();
        return await fromPromise(promise, errorMapper);
    }
    catch (e) {
        return err(errorMapper ? errorMapper(e) : e);
    }
};
