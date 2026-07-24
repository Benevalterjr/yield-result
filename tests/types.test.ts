import { describe, it, expect } from "vitest";
import {
  ok,
  err,
  isOk,
  isErr,
  map,
  mapErr,
  andThen,
  unwrapOr,
  unwrap,
  expectResult,
  tap,
  tapErr,
  match,
  all,
  partition,
  Result,
  taggedError,
} from "../src/types.js";

describe("ok/err constructors", () => {
  it("creates Ok and Err with expected shape", () => {
    const o = ok(42);
    const e = err("failed");
    expect(o.ok).toBe(true);
    expect(o.value).toBe(42);
    expect(e.ok).toBe(false);
    expect(e.error).toBe("failed");
  });

  it("isOk / isErr act as type guards", () => {
    const results = [ok(1), err("x")];
    expect(results.filter(isOk)).toHaveLength(1);
    expect(results.filter(isErr)).toHaveLength(1);
  });

  it("freezes Ok and Err instances for runtime immutability", () => {
    const o = ok(42);
    const e = err("fail");
    expect(Object.isFrozen(o)).toBe(true);
    expect(Object.isFrozen(e)).toBe(true);

    expect(() => {
      // @ts-expect-error - Testing runtime immutability
      o.value = 99;
    }).toThrow();
  });

  it("exposes Result namespace object with all constructors and combinators", () => {
    const o = Result.ok(10);
    const e = Result.err("fail");
    expect(Result.isOk(o)).toBe(true);
    expect(Result.isErr(e)).toBe(true);
    expect(Result.unwrap(o)).toBe(10);
  });

  it("creates immutable taggedError objects with _tag discriminator", () => {
    const NotFoundError = taggedError("NotFoundError", { resourceId: "123" });
    expect(NotFoundError._tag).toBe("NotFoundError");
    expect(NotFoundError.resourceId).toBe("123");
    expect(Object.isFrozen(NotFoundError)).toBe(true);
  });
});



describe("serialization and cloning", () => {
  it("Ok/Err serialize to simple JSON objects (Symbol.iterator function is omitted)", () => {
    const o = ok({ name: "Alice" });
    const e = err("insufficient balance");

    expect(JSON.parse(JSON.stringify(o))).toEqual({ ok: true, value: { name: "Alice" } });
    expect(JSON.parse(JSON.stringify(e))).toEqual({ ok: false, error: "insufficient balance" });
  });

  it("Ok/Err support structuredClone without throwing DataCloneError", () => {
    const o = ok(100);
    const e = err("network failure");

    const clonedOk = structuredClone(o);
    const clonedErr = structuredClone(e);

    expect(clonedOk.ok).toBe(true);
    expect(clonedOk.value).toBe(100);
    expect(clonedErr.ok).toBe(false);
    expect(clonedErr.error).toBe("network failure");
  });
});

describe("iterable protocol (making yield* work)", () => {
  it("Ok: iterator returns value immediately without yielding", () => {
    const o = ok(10);
    const iter = o[Symbol.iterator]();
    const step = iter.next();
    expect(step).toEqual({ done: true, value: 10 });
  });

  it("Err: iterator yields the Err object once", () => {
    const e = err("boom");
    const iter = e[Symbol.iterator]();
    const step = iter.next();
    expect(step.done).toBe(false);
    expect(step.value).toBe(e);

    // Resuming after yield throws an error
    expect(() => iter.next()).toThrow(/resumed/);
  });

  it("plain object without Symbol.iterator is not iterable", () => {
    const plainResult = { ok: true as const, value: 5 };

    function* generator() {
      // @ts-expect-error - plain object is not Iterable
      const x = yield* plainResult;
      return x;
    }

    expect(() => generator().next()).toThrow(/not iterable/);
  });
});

describe("deep equality testing caveat for iterables", () => {
  it("expect(...).toEqual(err(...)) throws because test runner attempts to iterate the Err object", () => {
    expect(() => {
      expect(err("x")).toEqual(err("x"));
    }).toThrow(/resumed/);
  });
});

describe("combinators", () => {
  it("map transforms success value only", () => {
    const r1 = map(ok(2), (n) => n * 10);
    expect(r1.ok && r1.value).toBe(20);

    const r2 = map(err("x"), (n: number) => n * 10);
    expect(!r2.ok && r2.error).toBe("x");
  });

  it("mapErr transforms error value only", () => {
    const r1 = mapErr(err("raw"), (e) => `error: ${e}`);
    expect(!r1.ok && r1.error).toBe("error: raw");

    const r2 = mapErr(ok(1), (e: string) => `error: ${e}`);
    expect(r2.ok && r2.value).toBe(1);
  });

  it("andThen chains without nesting", () => {
    const divide = (a: number, b: number) => (b === 0 ? err("division by zero") : ok(a / b));
    const r1 = andThen(ok(10), (n) => divide(n, 2));
    expect(r1.ok && r1.value).toBe(5);

    const r2 = andThen(ok(10), (n) => divide(n, 0));
    expect(!r2.ok && r2.error).toBe("division by zero");
  });

  it("unwrapOr returns fallback on error", () => {
    expect(unwrapOr(ok(1), 0)).toBe(1);
    expect(unwrapOr(err("x"), 0)).toBe(0);
  });

  it("unwrap extracts Ok value or throws Err value", () => {
    expect(unwrap(ok(42))).toBe(42);
    expect(() => unwrap(err(new Error("failed")))).toThrow("failed");
    expect(() => unwrap(err("simple text"))).toThrow("simple text");
  });

  it("expectResult extracts value or throws custom error message", () => {
    expect(expectResult(ok("data"), "Fetch failed")).toBe("data");
    expect(() => expectResult(err("404"), "Network error")).toThrow("Network error: 404");
  });

  it("tap executes side-effect on Ok only", () => {
    let captured = 0;
    tap(ok(10), (v) => {
      captured = v;
    });
    expect(captured).toBe(10);

    let capturedErr = 0;
    tap(err(20), (v: number) => {
      capturedErr = v;
    });
    expect(capturedErr).toBe(0);
  });

  it("tapErr executes side-effect on Err only", () => {
    let captured = "";
    tapErr(err("boom"), (e) => {
      captured = e;
    });
    expect(captured).toBe("boom");

    let capturedOk = "";
    tapErr(ok("success"), (e: string) => {
      capturedOk = e;
    });
    expect(capturedOk).toBe("");
  });

  it("match dispatches to correct handler", () => {
    const describeResult = (r: ReturnType<typeof ok<number>> | ReturnType<typeof err<string>>) =>
      match(r, { ok: (v) => `ok:${v}`, err: (e) => `err:${e}` });
    expect(describeResult(ok(3))).toBe("ok:3");
    expect(describeResult(err("failed"))).toBe("err:failed");
  });

  it("all combines array of Results into a single array Result", () => {
    const rSuccess = all([ok(1), ok(2), ok(3)]);
    expect(rSuccess.ok && rSuccess.value).toEqual([1, 2, 3]);

    const rFail = all([ok(1), err("error at 2"), ok(3)]);
    expect(!rFail.ok && rFail.error).toBe("error at 2");
  });

  it("partition separates array of Results into values and errors", () => {
    const results = [ok(10), err("e1"), ok(20), err("e2")];
    const { values, errors } = partition(results);
    expect(values).toEqual([10, 20]);
    expect(errors).toEqual(["e1", "e2"]);
  });
});


