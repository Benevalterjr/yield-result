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
export type Ok<T> = {
    readonly ok: true;
    readonly value: T;
    readonly [Symbol.iterator]: () => Generator<never, T, unknown>;
};
export type Err<E> = {
    readonly ok: false;
    readonly error: E;
    readonly [Symbol.iterator]: () => Generator<Err<E>, never, unknown>;
};
export type Result<T, E = string> = Ok<T> | Err<E>;
/**
 * Creates a successful Result containing a value.
 */
export declare const ok: <T>(value: T) => Ok<T>;
/**
 * Creates an error Result containing an error value.
 */
export declare const err: <E>(error: E) => Err<E>;
/**
 * Type guard for Ok results.
 */
export declare const isOk: <T, E>(result: Result<T, E>) => result is Ok<T>;
/**
 * Type guard for Err results.
 */
export declare const isErr: <T, E>(result: Result<T, E>) => result is Err<E>;
/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to a successful value.
 */
export declare const map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U) => Result<U, E>;
/**
 * Maps a Result<T, E> to Result<T, F> by applying a function to an error value.
 */
export declare const mapErr: <T, E, F>(result: Result<T, E>, fn: (error: E) => F) => Result<T, F>;
/**
 * Chains another Result-returning function if the result is Ok.
 */
export declare const andThen: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>) => Result<U, E>;
/**
 * Returns the contained Ok value or a fallback value if Err.
 */
export declare const unwrapOr: <T, E>(result: Result<T, E>, fallback: T) => T;
/**
 * Extracts the contained Ok value, or throws the contained Error.
 */
export declare const unwrap: <T, E>(result: Result<T, E>) => T;
/**
 * Extracts the contained Ok value, or throws a custom error message.
 */
export declare const expectResult: <T, E>(result: Result<T, E>, msg: string) => T;
/**
 * Executes a side-effect function if the result is Ok.
 */
export declare const tap: <T, E>(result: Result<T, E>, fn: (value: T) => void) => Result<T, E>;
/**
 * Executes a side-effect function if the result is Err.
 */
export declare const tapErr: <T, E>(result: Result<T, E>, fn: (error: E) => void) => Result<T, E>;
/**
 * Pattern matches on a Result, executing the ok or err handler.
 */
export declare const match: <T, E, R>(result: Result<T, E>, handlers: {
    ok: (value: T) => R;
    err: (error: E) => R;
}) => R;
/**
 * Combines an array of Results into a single Result containing an array of values.
 * Short-circuits on the first Err.
 */
export declare const all: <T, E>(results: Result<T, E>[]) => Result<T[], E>;
/**
 * Partitions an array of Results into separate values and errors arrays.
 */
export declare const partition: <T, E>(results: Result<T, E>[]) => {
    values: T[];
    errors: E[];
};
/**
 * Namespace object grouping all Result constructors, guards, and combinators.
 */
export declare const Result: {
    readonly ok: <T>(value: T) => Ok<T>;
    readonly err: <E>(error: E) => Err<E>;
    readonly isOk: <T, E>(result: Result<T, E>) => result is Ok<T>;
    readonly isErr: <T, E>(result: Result<T, E>) => result is Err<E>;
    readonly map: <T, U, E>(result: Result<T, E>, fn: (value: T) => U) => Result<U, E>;
    readonly mapErr: <T, E, F>(result: Result<T, E>, fn: (error: E) => F) => Result<T, F>;
    readonly andThen: <T, U, E>(result: Result<T, E>, fn: (value: T) => Result<U, E>) => Result<U, E>;
    readonly unwrapOr: <T, E>(result: Result<T, E>, fallback: T) => T;
    readonly unwrap: <T, E>(result: Result<T, E>) => T;
    readonly expect: <T, E>(result: Result<T, E>, msg: string) => T;
    readonly tap: <T, E>(result: Result<T, E>, fn: (value: T) => void) => Result<T, E>;
    readonly tapErr: <T, E>(result: Result<T, E>, fn: (error: E) => void) => Result<T, E>;
    readonly match: <T, E, R>(result: Result<T, E>, handlers: {
        ok: (value: T) => R;
        err: (error: E) => R;
    }) => R;
    readonly all: <T, E>(results: Result<T, E>[]) => Result<T[], E>;
    readonly partition: <T, E>(results: Result<T, E>[]) => {
        values: T[];
        errors: E[];
    };
};
