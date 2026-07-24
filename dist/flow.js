import { ok, err, isOk, isErr } from "./types.js";
/**
 * Control flow runners for evaluating generator functions with short-circuiting on Err.
 */
export const safe = {
    /**
     * Evaluates a synchronous generator function, returning Ok(value) on completion,
     * or short-circuiting on the first yielded Err(error).
     */
    sync: (fn) => {
        let gen;
        try {
            gen = fn();
        }
        catch (e) {
            return err(e);
        }
        try {
            const next = gen.next();
            if (!next.done) {
                // Safety guard: detects if developer forgot the '*' when yielding an Ok or non-Err value
                if (isOk(next.value)) {
                    try {
                        gen.return(undefined);
                    }
                    catch (_) { }
                    throw new Error("Incorrect 'yield' usage: missing asterisk '*'. Use 'yield* result' instead of 'yield result'.");
                }
                if (!isErr(next.value)) {
                    try {
                        gen.return(undefined);
                    }
                    catch (_) { }
                    throw new Error("Incorrect 'yield' usage: generator yielded a value that is not a Result Err. Make sure to use 'yield* result'.");
                }
                // Trigger resource cleanup for try...finally blocks in suspended generator
                try {
                    gen.return(undefined);
                }
                catch (_) { }
                return next.value;
            }
            return ok(next.value);
        }
        catch (e) {
            if (e instanceof Error && e.message.includes("Incorrect 'yield' usage")) {
                throw e;
            }
            try {
                gen.return(undefined);
            }
            catch (_) { }
            return err(e);
        }
    },
    /**
     * Evaluates an async generator function, returning Ok(value) on completion,
     * or short-circuiting on the first yielded Err(error).
     */
    async: async (fn) => {
        let gen;
        try {
            gen = fn();
        }
        catch (e) {
            return err(e);
        }
        try {
            const next = await gen.next();
            if (!next.done) {
                if (isOk(next.value)) {
                    try {
                        await gen.return(undefined);
                    }
                    catch (_) { }
                    throw new Error("Incorrect 'yield' usage: missing asterisk '*'. Use 'yield* result' instead of 'yield result'.");
                }
                if (!isErr(next.value)) {
                    try {
                        await gen.return(undefined);
                    }
                    catch (_) { }
                    throw new Error("Incorrect 'yield' usage: generator yielded a value that is not a Result Err. Make sure to use 'yield* result'.");
                }
                try {
                    await gen.return(undefined);
                }
                catch (_) { }
                return next.value;
            }
            return ok(next.value);
        }
        catch (e) {
            if (e instanceof Error && e.message.includes("Incorrect 'yield' usage")) {
                throw e;
            }
            try {
                await gen.return(undefined);
            }
            catch (_) { }
            return err(e);
        }
    },
};
