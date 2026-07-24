import { describe, it, expect } from "vitest";
import { ok, err, Result } from "../src/types.js";
import { safe } from "../src/flow.js";
import { fromPromise } from "../src/wrappers.js";

describe("safe.sync", () => {
  it("returns Ok when all steps succeed", () => {
    const divide = (a: number, b: number): Result<number, string> =>
      b === 0 ? err("division by zero") : ok(a / b);

    const result = safe.sync(function* () {
      const x = yield* divide(10, 2); // 5
      const y = yield* divide(x, 5); // 1
      return x + y;
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toBe(6);
  });

  it("short-circuits on the first error and skips remaining steps", () => {
    let executedAfterError = false;

    const divide = (a: number, b: number): Result<number, string> =>
      b === 0 ? err("division by zero") : ok(a / b);

    const result = safe.sync(function* () {
      const x = yield* divide(10, 0); // fails here
      executedAfterError = true;
      const y = yield* divide(x, 5);
      return x + y;
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("division by zero");
    expect(executedAfterError).toBe(false);
  });

  it("executes finally block in generator when aborted by an Err (resource cleanup)", () => {
    let finallyExecuted = false;

    const fail = (): Result<number, string> => err("fatal error");

    const result = safe.sync(function* () {
      try {
        yield* fail();
        return 42;
      } finally {
        finallyExecuted = true;
      }
    });

    expect(result.ok).toBe(false);
    expect(finallyExecuted).toBe(true);
  });

  it("captures unexpected runtime exceptions (throw) inside generator", () => {
    const result = safe.sync(function* () {
      if (true) {
        throw new Error("runtime exception");
      }
      return 10;
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && (result.error as Error).message).toBe("runtime exception");
  });

  it("throws clear syntax error when detecting 'yield' without asterisk on an Ok", () => {
    expect(() => {
      safe.sync(function* () {
        // @ts-expect-error - Testing missing asterisk runtime error
        yield ok(10);
        return 20;
      });
    }).toThrow(/missing asterisk/);
  });

  it("automatically infers unions of different error types across steps", () => {
    type ErrorA = { kind: "A"; msg: string };
    type ErrorB = { kind: "B"; code: number };

    const step1 = (): Result<number, ErrorA> => ok(10);
    const step2 = (): Result<boolean, ErrorB> => ok(true);

    const result = safe.sync(function* () {
      const a = yield* step1();
      const b = yield* step2();
      return { a, b };
    });

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ a: 10, b: true });
    }
  });
});


describe("safe.async", () => {
  const fetchUser = (id: number): Promise<Result<{ age: number }, string>> =>
    fromPromise(
      id === 1 ? Promise.resolve({ age: 20 }) : Promise.reject(new Error("user not found")),
      (e) => (e as Error).message
    );

  const validateAdult = (user: { age: number }): Result<boolean, string> =>
    user.age >= 18 ? ok(true) : err("user is underage");

  it("evaluates async generator flow correctly", async () => {
    const result = await safe.async(async function* () {
      const user = yield* await fetchUser(1);
      const isAdult = yield* validateAdult(user);
      return { status: "Approved", user, permission: isAdult };
    });

    expect(result.ok).toBe(true);
    expect(result.ok && result.value).toEqual({
      status: "Approved",
      user: { age: 20 },
      permission: true,
    });
  });

  it("short-circuits when fetching user fails without running validation", async () => {
    let validationCalled = false;

    const result = await safe.async(async function* () {
      const user = yield* await fetchUser(999); // fails: user not found
      validationCalled = true;
      const isAdult = yield* validateAdult(user);
      return { status: "Approved", user, permission: isAdult };
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("user not found");
    expect(validationCalled).toBe(false);
  });

  it("short-circuits on second step when first step succeeded", async () => {
    const fetchMinor = (): Promise<Result<{ age: number }, string>> =>
      fromPromise(Promise.resolve({ age: 15 }));

    const result = await safe.async(async function* () {
      const user = yield* await fetchMinor();
      const isAdult = yield* validateAdult(user);
      return { status: "Approved", isAdult };
    });

    expect(result.ok).toBe(false);
    expect(!result.ok && result.error).toBe("user is underage");
  });

  it("executes finally block in async generator when aborted by Err", async () => {
    let finallyExecuted = false;

    const failAsync = (): Promise<Result<number, string>> =>
      Promise.resolve(err("async error"));

    const result = await safe.async(async function* () {
      try {
        yield* await failAsync();
        return 100;
      } finally {
        finallyExecuted = true;
      }
    });

    expect(result.ok).toBe(false);
    expect(finallyExecuted).toBe(true);
  });
});


