/**
 * Core Result type: simple discriminated unions without classes.
 *
 * For `yield* result` to work inside a generator function, `result`
 * must implement the Iterable protocol (`Symbol.iterator`).
 *
 *  - Ok: the iterator returns `value` immediately without yielding.
 *    This allows `yield* ok(x)` to evaluate synchronously to `x`.
 *  - Err: the iterator yields `this` (the Err object) once.
 *    This propagates the Err object to the runner in `flow.ts` to abort execution.
 */
// Shared prototypes for memory optimization and structuredClone support
const OkPrototype = {
    ok: true,
    *[Symbol.iterator]() {
        return this.value;
    },
};
const ErrPrototype = {
    ok: false,
    *[Symbol.iterator]() {
        yield this;
        throw new Error("Err iterator resumed after yield — indicates an invalid generator runner execution.");
    },
};
/**
 * Creates a successful Result containing a value.
 */
export const ok = (value) => {
    const instance = Object.create(OkPrototype);
    instance.ok = true;
    instance.value = value;
    return Object.freeze(instance);
};
/**
 * Creates an error Result containing an error value.
 */
export const err = (error) => {
    const instance = Object.create(ErrPrototype);
    instance.ok = false;
    instance.error = error;
    return Object.freeze(instance);
};
/**
 * Type guard for Ok results.
 */
export const isOk = (result) => result.ok;
/**
 * Type guard for Err results.
 */
export const isErr = (result) => !result.ok;
// --- Combinators ---
/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to a successful value.
 */
export const map = (result, fn) => result.ok ? ok(fn(result.value)) : result;
/**
 * Maps a Result<T, E> to Result<T, F> by applying a function to an error value.
 */
export const mapErr = (result, fn) => result.ok ? result : err(fn(result.error));
/**
 * Chains another Result-returning function if the result is Ok.
 */
export const andThen = (result, fn) => (result.ok ? fn(result.value) : result);
/**
 * Returns the contained Ok value or a fallback value if Err.
 */
export const unwrapOr = (result, fallback) => result.ok ? result.value : fallback;
/**
 * Extracts the contained Ok value, or throws the contained Error.
 */
export const unwrap = (result) => {
    if (result.ok)
        return result.value;
    if (result.error instanceof Error)
        throw result.error;
    throw new Error(String(result.error));
};
/**
 * Extracts the contained Ok value, or throws a custom error message.
 */
export const expectResult = (result, msg) => {
    if (result.ok)
        return result.value;
    throw new Error(`${msg}: ${String(result.error)}`);
};
/**
 * Executes a side-effect function if the result is Ok.
 */
export const tap = (result, fn) => {
    if (result.ok)
        fn(result.value);
    return result;
};
/**
 * Executes a side-effect function if the result is Err.
 */
export const tapErr = (result, fn) => {
    if (!result.ok)
        fn(result.error);
    return result;
};
/**
 * Pattern matches on a Result, executing the ok or err handler.
 */
export const match = (result, handlers) => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));
/**
 * Combines an array of Results into a single Result containing an array of values.
 * Short-circuits on the first Err.
 */
export const all = (results) => {
    const values = [];
    for (const r of results) {
        if (!r.ok)
            return err(r.error);
        values.push(r.value);
    }
    return ok(values);
};
/**
 * Partitions an array of Results into separate values and errors arrays.
 */
export const partition = (results) => {
    const values = [];
    const errors = [];
    for (const r of results) {
        if (r.ok) {
            values.push(r.value);
        }
        else {
            errors.push(r.error);
        }
    }
    return { values, errors };
};
/**
 * Creates an immutable TaggedError object with a `_tag` property and optional payload properties.
 */
export const taggedError = (tag, props) => Object.freeze({
    _tag: tag,
    ...(props ?? {}),
});
import { safe } from "./flow.js";
const genRunner = Object.assign((fn) => safe.sync(fn), {
    sync: safe.sync,
    async: safe.async,
});
/**
 * Namespace object grouping all Result constructors, guards, combinators, and generator runners.
 */
export const Result = {
    ok,
    err,
    isOk,
    isErr,
    map,
    mapErr,
    andThen,
    unwrapOr,
    unwrap,
    expect: expectResult,
    tap,
    tapErr,
    match,
    all,
    partition,
    taggedError,
    gen: genRunner,
};
