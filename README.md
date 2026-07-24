# yield-result

> Rust-style `?` operator for TypeScript using generators (`yield*`). Zero dependencies, lightweight, type-safe error handling without runtime exceptions.

[![TypeScript](https://img.shields.io/badge/TypeScript-5.5+-blue.svg)](https://www.typescriptlang.org/)
[![Vitest](https://img.shields.io/badge/tested%20with-vitest-blueviolet.svg)](https://vitest.dev/)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)

---

## ⚡ Why `yield-result`?

In languages like Rust, the `?` operator unbinds a `Result` value with automatic early-return short-circuiting on errors—avoiding deep callback nesting (`.then()`, `.flatMap()`) and `try/catch` exception overhead.

JavaScript/TypeScript does not support custom operator overloading, but ECMAScript **`yield*`** (generator delegation) provides the **exact same semantics natively**!

### Syntax Comparison

```typescript
// ❌ BEFORE: Try/catch nesting or monadic chain hell
async function processOrder(id: string) {
  try {
    const order = await fetchOrder(id);
    if (!order) return { error: "Order not found" };
    
    const stock = await reserveStock(order);
    if (!stock.ok) return { error: stock.error };

    return { ok: true, data: stock.value };
  } catch (e) {
    return { error: String(e) };
  }
}

// ✅ WITH YIELD-RESULT: Linear, type-safe, synchronous or async, zero try/catch
import { safe, Result } from "yield-result";

const processOrder = (id: string) => safe.async(async function* () {
  const order = yield* await fetchOrder(id);   // If Err, short-circuits and early-returns Err!
  const stock = yield* await reserveStock(order);
  
  return { status: "Success", stock };
});
```

---

## 🚀 Installation

```bash
npm install yield-result
```

---

## 🏎️ Performance Benchmarks

Benchmarked using `vitest bench` (powered by `tinybench`) on Node.js:

### 🔴 Unhappy Path (Error Triggered)

When errors actually occur during domain execution:

| Implementation | Operations / sec | Benchmark Summary |
| :--- | :---: | :--- |
| **`yield-result` (`safe.sync`)** | **`207,485 ops/sec`** | ⚡ **3.55x FASTER than native try/catch** |
| **Native `try/catch` with `throw`** | **`58,515 ops/sec`** | 🐢 3.55x slower |

> 🏆 **Why is `yield-result` 3.55x faster on errors?**  
> Native `throw new Error()` forces JavaScript V8 engines to pause execution, capture call stack frames, allocate Error objects, and deoptimize JIT loops. In `yield-result`, returning an `Err` is just returning a plain object without unwinding stack frames.

### 🟢 Happy Path (Success Flow)

| Implementation | Operations / sec | Average Latency |
| :--- | :---: | :---: |
| **Native `try/catch` (no throw)** | `11,372,962 ops/sec` | `0.0001 ms` |
| **`yield-result` (`safe.sync`)** | `231,068 ops/sec` | `0.0043 ms` |

*Over 230,000 complete domain pipelines evaluated per second on a single thread—zero impact on network or database latencies.*

---

## 📖 Usage Guide

### 1. Creating Results

```typescript
import { ok, err, Result } from "yield-result";

function divide(a: number, b: number): Result<number, string> {
  if (b === 0) return err("Division by zero");
  return ok(a / b);
}
```

### 2. Composing Pipelines (`safe.sync` and `safe.async`)

Use `safe.sync` for synchronous workflows and `safe.async` for asynchronous workflows:

```typescript
import { safe, ok, err } from "yield-result";

const result = safe.sync(function* () {
  const a = yield* divide(100, 2); // a = 50
  const b = yield* divide(a, 5);   // b = 10
  return a + b;                    // Returns ok(60)
});

console.log(result); // { ok: true, value: 60 }
```

### 3. Integrating with Throwable & Async Code

Convert legacy functions that throw exceptions or return Promises:

```typescript
import { fromThrowable, fromPromise, fromAsyncFn } from "yield-result";

// Sync throwable functions (e.g. JSON.parse)
const jsonRes = fromThrowable(() => JSON.parse('{"status": "ok"}'));

// Promises
const fetchRes = await fromPromise(
  fetch("https://api.example.com/data").then(r => r.json()),
  (err) => `API Error: ${err}`
);

// Async Functions (handles both sync throws and promise rejections)
const asyncRes = await fromAsyncFn(() => loadData());
```

---

## 🛡️ Built-in Safety Features

### Runtime Protection against Missing Asterisk (`*`)

Forgetting the asterisk (`yield` instead of `yield*`) is automatically intercepted at runtime and in TypeScript:

```typescript
safe.sync(function* () {
  // ❌ Dev forgets the asterisk:
  const data = yield divide(10, 2); 
});

// 💥 Throws an immediate explanatory Error:
// Error: Incorrect 'yield' usage: missing asterisk '*'. Use 'yield* result' instead of 'yield result'.
```

---

## 🛠️ Complete API Reference

### Constructors & Guards
* **`ok(value)`** / **`Result.ok(value)`** — Creates an `Ok<T>` result.
* **`err(error)`** / **`Result.err(error)`** — Creates an `Err<E>` result.
* **`isOk(result)`** / **`isErr(result)`** — TypeScript type guards.

### Flow Runners (`safe`)
* **`safe.sync(function* () { ... })`** — Executes a synchronous generator function with early-return short-circuiting on `Err`.
* **`safe.async(async function* () { ... })`** — Executes an async generator function with early-return short-circuiting on `Err`.

### Exception Wrappers
* **`fromThrowable(fn, errorMapper?)`** — Wraps a throwing function into a `Result<T, E>`.
* **`fromPromise(promise, errorMapper?)`** — Wraps a Promise into `Promise<Result<T, E>>`.
* **`fromAsyncFn(fn, errorMapper?)`** — Wraps an async function into `Promise<Result<T, E>>`.

### Combinators & Utilities
* **`map(result, fn)`** — Transforms the `Ok` value.
* **`mapErr(result, fn)`** — Transforms the `Err` value.
* **`andThen(result, fn)`** — Chains a new Result-returning function if `Ok`.
* **`unwrapOr(result, fallback)`** — Returns contained `Ok` value or fallback.
* **`unwrap(result)`** — Extracts `Ok` value or throws `Err`.
* **`expectResult(result, msg)`** — Extracts `Ok` value or throws custom error message.
* **`tap(result, fn)`** — Runs side-effect function if `Ok`.
* **`tapErr(result, fn)`** — Runs side-effect function if `Err`.
* **`match(result, { ok, err })`** — Pattern matches on Ok or Err.
* **`all([r1, r2, r3])`** — Combines `Result<T, E>[]` into `Result<T[], E>`.
* **`partition(results)`** — Partitions array of Results into `{ values, errors }`.

---

## 🧪 Testing & Benchmarks

```bash
npm run test        # Runs all Vitest unit tests (39 tests)
npm run test:types  # Runs strict TypeScript type-checking (tsc --noEmit)
npm run bench       # Runs performance benchmarks (vitest bench)
npm run build       # Compiles output to dist/
```

---

## ⚖️ License

MIT © yield-result contributors


