import { Result, Err } from "./types.js";
type InferYieldErr<G> = G extends Generator<infer Y, unknown, unknown> ? Y extends Err<infer E> ? E : never : G extends AsyncGenerator<infer Y, unknown, unknown> ? Y extends Err<infer E> ? E : never : never;
type InferReturn<G> = G extends Generator<unknown, infer R, unknown> ? R : G extends AsyncGenerator<unknown, infer R, unknown> ? R : never;
/**
 * Control flow runners for evaluating generator functions with short-circuiting on Err.
 */
export declare const safe: {
    /**
     * Evaluates a synchronous generator function, returning Ok(value) on completion,
     * or short-circuiting on the first yielded Err(error).
     * Automatically infers and unifies error types yielded across all steps.
     */
    sync: <G extends Generator<Err<unknown>, unknown, unknown>>(fn: () => G) => Result<InferReturn<G>, InferYieldErr<G>>;
    /**
     * Evaluates an async generator function, returning Ok(value) on completion,
     * or short-circuiting on the first yielded Err(error).
     * Automatically infers and unifies error types yielded across all steps.
     */
    async: <G extends AsyncGenerator<Err<unknown>, unknown, unknown>>(fn: () => G) => Promise<Result<InferReturn<G>, InferYieldErr<G>>>;
};
export {};
