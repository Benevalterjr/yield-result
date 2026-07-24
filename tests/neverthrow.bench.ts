import { bench, describe } from "vitest";
import { ok as yrOk, err as yrErr, safe as yrSafe } from "../src/index.js";
import { ok as ntOk, err as ntErr, safeTry as ntSafeTry } from "neverthrow";

// --- Functions returning yield-result ---
function divideYR(a: number, b: number) {
  return b === 0 ? yrErr("division by zero") : yrOk(a / b);
}

// --- Functions returning neverthrow ---
function divideNT(a: number, b: number) {
  return b === 0 ? ntErr("division by zero") : ntOk(a / b);
}

describe("yield-result vs neverthrow (Happy Path - 3 Steps)", () => {
  bench("yield-result (safe.sync with yield*)", () => {
    yrSafe.sync(function* () {
      const a = yield* divideYR(100, 2);
      const b = yield* divideYR(a, 2);
      const c = yield* divideYR(b, 2);
      return c;
    });
  });

  bench("neverthrow (safeTry with yield*)", () => {
    ntSafeTry(function* () {
      const a = yield* divideNT(100, 2).safeUnwrap();
      const b = yield* divideNT(a, 2).safeUnwrap();
      const c = yield* divideNT(b, 2).safeUnwrap();
      return ntOk(c);
    });
  });

  bench("neverthrow (chaining with .andThen())", () => {
    divideNT(100, 2)
      .andThen((a) => divideNT(a, 2))
      .andThen((b) => divideNT(b, 2));
  });
});

describe("yield-result vs neverthrow (Unhappy Path - Error at Step 1)", () => {
  bench("yield-result short-circuit on Err", () => {
    yrSafe.sync(function* () {
      const a = yield* divideYR(100, 0); // Fails here
      const b = yield* divideYR(a, 2);
      return b;
    });
  });

  bench("neverthrow safeTry short-circuit on Err", () => {
    ntSafeTry(function* () {
      const a = yield* divideNT(100, 0).safeUnwrap(); // Fails here
      const b = yield* divideNT(a, 2).safeUnwrap();
      return ntOk(b);
    });
  });

  bench("neverthrow .andThen() short-circuit on Err", () => {
    divideNT(100, 0)
      .andThen((a) => divideNT(a, 2))
      .andThen((b) => divideNT(b, 2));
  });
});
