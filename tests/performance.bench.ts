import { bench, describe } from "vitest";
import { ok, err, Result } from "../src/types.js";
import { safe } from "../src/flow.js";

function divideResult(a: number, b: number): Result<number, string> {
  return b === 0 ? err("division by zero") : ok(a / b);
}

function divideNativeThrow(a: number, b: number): number {
  if (b === 0) throw new Error("division by zero");
  return a / b;
}

describe("yield-result Happy Path (Success)", () => {
  bench("safe.sync pipeline (3 successful steps)", () => {
    safe.sync(function* () {
      const a = yield* divideResult(100, 2);
      const b = yield* divideResult(a, 2);
      const c = yield* divideResult(b, 2);
      return c;
    });
  });

  bench("native try/catch pipeline (3 successful steps)", () => {
    try {
      const a = divideNativeThrow(100, 2);
      const b = divideNativeThrow(a, 2);
      const c = divideNativeThrow(b, 2);
      return c;
    } catch (e) {
      return null;
    }
  });

  bench("manual if-statement Result pipeline (3 successful steps)", () => {
    const r1 = divideResult(100, 2);
    if (!r1.ok) return r1;
    const r2 = divideResult(r1.value, 2);
    if (!r2.ok) return r2;
    const r3 = divideResult(r2.value, 2);
    if (!r3.ok) return r3;
    return r3;
  });
});

describe("yield-result Unhappy Path (Error Triggered)", () => {
  bench("safe.sync short-circuit on error (fails at step 1)", () => {
    safe.sync(function* () {
      const a = yield* divideResult(100, 0); // Fails here!
      const b = yield* divideResult(a, 2);
      return b;
    });
  });

  bench("native try/catch with throw (fails at step 1)", () => {
    try {
      const a = divideNativeThrow(100, 0); // Throws Error here!
      const b = divideNativeThrow(a, 2);
      return b;
    } catch (e) {
      return null;
    }
  });
});
