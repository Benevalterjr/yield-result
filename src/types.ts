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

// Shared prototypes for memory optimization and structuredClone support
const OkPrototype = {
  ok: true as const,
  *[Symbol.iterator]<T>(this: Ok<T>) {
    return this.value;
  },
};

const ErrPrototype = {
  ok: false as const,
  *[Symbol.iterator]<E>(this: Err<E>) {
    yield this;
    throw new Error(
      "Err iterator resumed after yield — indicates an invalid generator runner execution."
    );
  },
};

/**
 * Creates a successful Result containing a value.
 */
export const ok = <T>(value: T): Ok<T> => {
  const instance = Object.create(OkPrototype);
  instance.ok = true;
  instance.value = value;
  return Object.freeze(instance) as Ok<T>;
};

/**
 * Creates an error Result containing an error value.
 */
export const err = <E>(error: E): Err<E> => {
  const instance = Object.create(ErrPrototype);
  instance.ok = false;
  instance.error = error;
  return Object.freeze(instance) as Err<E>;
};

/**
 * Type guard for Ok results.
 */
export const isOk = <T, E>(result: Result<T, E>): result is Ok<T> => result.ok;

/**
 * Type guard for Err results.
 */
export const isErr = <T, E>(result: Result<T, E>): result is Err<E> => !result.ok;


// --- Combinators ---

/**
 * Maps a Result<T, E> to Result<U, E> by applying a function to a successful value.
 */
export const map = <T, U, E>(result: Result<T, E>, fn: (value: T) => U): Result<U, E> =>
  result.ok ? ok(fn(result.value)) : result;

/**
 * Maps a Result<T, E> to Result<T, F> by applying a function to an error value.
 */
export const mapErr = <T, E, F>(result: Result<T, E>, fn: (error: E) => F): Result<T, F> =>
  result.ok ? result : err(fn(result.error));

/**
 * Chains another Result-returning function if the result is Ok.
 */
export const andThen = <T, U, E>(
  result: Result<T, E>,
  fn: (value: T) => Result<U, E>
): Result<U, E> => (result.ok ? fn(result.value) : result);

/**
 * Returns the contained Ok value or a fallback value if Err.
 */
export const unwrapOr = <T, E>(result: Result<T, E>, fallback: T): T =>
  result.ok ? result.value : fallback;

/**
 * Extracts the contained Ok value, or throws the contained Error.
 */
export const unwrap = <T, E>(result: Result<T, E>): T => {
  if (result.ok) return result.value;
  if (result.error instanceof Error) throw result.error;
  throw new Error(String(result.error));
};

/**
 * Extracts the contained Ok value, or throws a custom error message.
 */
export const expectResult = <T, E>(result: Result<T, E>, msg: string): T => {
  if (result.ok) return result.value;
  throw new Error(`${msg}: ${String(result.error)}`);
};

/**
 * Executes a side-effect function if the result is Ok.
 */
export const tap = <T, E>(result: Result<T, E>, fn: (value: T) => void): Result<T, E> => {
  if (result.ok) fn(result.value);
  return result;
};

/**
 * Executes a side-effect function if the result is Err.
 */
export const tapErr = <T, E>(result: Result<T, E>, fn: (error: E) => void): Result<T, E> => {
  if (!result.ok) fn(result.error);
  return result;
};

/**
 * Pattern matches on a Result, executing the ok or err handler.
 */
export const match = <T, E, R>(
  result: Result<T, E>,
  handlers: { ok: (value: T) => R; err: (error: E) => R }
): R => (result.ok ? handlers.ok(result.value) : handlers.err(result.error));

/**
 * Combines an array of Results into a single Result containing an array of values.
 * Short-circuits on the first Err.
 */
export const all = <T, E>(results: Result<T, E>[]): Result<T[], E> => {
  const values: T[] = [];
  for (const r of results) {
    if (!r.ok) return err(r.error);
    values.push(r.value);
  }
  return ok(values);
};

/**
 * Partitions an array of Results into separate values and errors arrays.
 */
export const partition = <T, E>(results: Result<T, E>[]): { values: T[]; errors: E[] } => {
  const values: T[] = [];
  const errors: E[] = [];
  for (const r of results) {
    if (r.ok) {
      values.push(r.value);
    } else {
      errors.push(r.error);
    }
  }
  return { values, errors };
};

/**
 * Interface representing a discriminated error object with a `_tag` property.
 */
export interface TaggedError<T extends string> {
  readonly _tag: T;
}

/**
 * Creates an immutable TaggedError object with a `_tag` property and optional payload properties.
 */
export const taggedError = <T extends string, P extends Record<string, unknown> = {}>(
  tag: T,
  props?: P
): Readonly<TaggedError<T> & P> =>
  Object.freeze({
    _tag: tag,
    ...(props ?? {}),
  } as TaggedError<T> & P);

import { safe } from "./flow.js";

const genRunner = Object.assign(
  <G extends Generator<Err<unknown>, unknown, unknown>>(fn: () => G) => safe.sync(fn),
  {
    sync: safe.sync,
    async: safe.async,
  }
);

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
} as const;





