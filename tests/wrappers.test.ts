import { describe, it, expect } from "vitest";
import { fromThrowable, fromPromise, fromAsyncFn } from "../src/wrappers.js";

describe("fromThrowable", () => {
  it("captures successful return value", () => {
    const r = fromThrowable(() => JSON.parse('{"a":1}'));
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toEqual({ a: 1 });
  });

  it("captures thrown exception and preserves original error", () => {
    const r = fromThrowable(() => JSON.parse("{invalid"));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error).toBeInstanceOf(SyntaxError);
    }
  });

  it("captures non-Error thrown values (string, number)", () => {
    const r = fromThrowable(() => {
      // eslint-disable-next-line no-throw-literal
      throw "something went wrong";
    });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("something went wrong");
  });

  it("applies errorMapper when provided", () => {
    const r = fromThrowable(
      () => {
        throw new Error("boom");
      },
      (e) => (e as Error).message.toUpperCase()
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("BOOM");
  });
});

describe("fromPromise", () => {
  it("captures promise resolution", async () => {
    const r = await fromPromise(Promise.resolve(42));
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toBe(42);
  });

  it("captures promise rejection and preserves original error", async () => {
    const r = await fromPromise(Promise.reject(new Error("network failure")));
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect((r.error as Error).message).toBe("network failure");
    }
  });

  it("applies errorMapper on promise rejections", async () => {
    const r = await fromPromise(
      Promise.reject(new Error("500")),
      (e) => `Mapped HTTP: ${(e as Error).message}`
    );
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error).toBe("Mapped HTTP: 500");
  });
});

describe("fromAsyncFn", () => {
  it("defers promise creation until called", async () => {
    let executed = false;
    const task = () => {
      executed = true;
      return Promise.resolve("done");
    };

    expect(executed).toBe(false);
    const r = await fromAsyncFn(task);
    expect(executed).toBe(true);
    expect(r.ok).toBe(true);
    expect(r.ok && r.value).toBe("done");
  });

  it("captures synchronous exception thrown before promise generation", async () => {
    const syncErrorTask = () => {
      throw new Error("sync error before promise");
    };

    const r = await fromAsyncFn(syncErrorTask);
    expect(r.ok).toBe(false);
    expect(!r.ok && (r.error as Error).message).toBe("sync error before promise");
  });
});


