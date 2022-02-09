## Overview

Tiny syntactic shortcuts for native `Request`/`Response`/`Headers`/`fetch`.

* Fluent builder-style API.
* Interoperable with built-ins.
* Shortcuts for common actions, such as:
  * Building HTTP requests.
    * A builder-style API is more concise and flexible than the native one.
  * Handling HTTP errors in responses.
    * Constructing descriptive exceptions with HTTP status and response text.
* Tiny, dependency-free, single file, native module.

## TOC

* [#Usage](#usage)
* [#API](#api)
  * [`function req`](#function-req)
  * [`class Err`](#class-err)
  * [`class Req`](#class-req)
  * [`class Res`](#class-res)
  * [`class Head`](#class-head)
  * [`function jsonDecode`](#function-jsondecode)
  * [`function jsonEncode`](#function-jsonencode)
  * [Undocumented](#undocumented)
* [#Changelog](#changelog)
* [#License](#license)
* [#Misc](#misc)

## Usage

In browsers and Deno, import by URL:

```js
import * as h from 'https://cdn.jsdelivr.net/npm/xhttp@0.15.3/xhttp.mjs'
```

When using Node or NPM-oriented bundlers like Esbuild:

```sh
npm i -E xhttp
```

Example usage:

```js
const reqBody = {msg: `hello world`}
const resBody = await h.req().to(`/api`).post().json(reqBody).fetchOkJson()
```

## API

### `function req`

Same as [#`new Req`](#class-req) but syntactically shorter.

### `class Err`

Subclass of `Error` for HTTP responses. The error message includes the HTTP status code, if any.

```ts
class Err extends Error {
  message: string
  status: int
  res?: Response

  constructor(message: string, status: int, res?: Response)
}
```

### `class Req`

Request builder. Does _not_ subclass `Request`. Call `.req()` to create a native request, or the various `.fetchX()` methods to immediately execute. Unlike the native request, the body is not always a stream. This means `Req` can be stored and reused several times.

```ts
class Req extends RequestInit {
  /*
  Similar to `fetch(this.req())`, but also constructs `Res` from the resulting
  response.
  */
  fetch(): Promise<Res>

  /*
  Returns the resulting `Res` if the response is OK. If the response is
  received, but HTTP status code is non-OK, throws a descriptive `Err`.

  Shortcut for `(await this.fetch()).okRes()`.
  */
  fetchOk(): Promise<Res>

  // Shortcut for `(await this.fetch()).okText()`.
  fetchOkText(): Promise<string>

  // Shortcut for `(await this.fetch()).okJson()`.
  fetchOkJson(): Promise<any>

  /*
  Mutates the request by applying the given options and returns the same
  reference. Automatically merges headers.
  */
  mut(init: RequestInit): Req

  // Shortcut for `new Request(this.url, this)`.
  req(): Request

  // Sets `.url` and returns the same reference.
  to(val: string | {toString(): string}): Res

  // Sets `.signal` and returns the same reference.
  sig(val: AbortSignal): Res

  // Sets `.method` and returns the same reference.
  meth(val: string): Res

  // Sets `.body` and returns the same reference. Short for "input".
  inp(val: BodyInit): Res

  // JSON-encodes the input, sets `.body`, and sets JSON request headers.
  // Does NOT set the `accept` header. Returns the same reference.
  json(val: any): Res

  // Shortcuts for setting the corresponding HTTP method.
  get(): Res
  post(): Res
  put(): Res
  patch(): Res
  delete(): Res

  // Idempotently sets `.headers` and returns the resulting reference.
  head(): Head

  // Shortcuts for modifying the headers. All mutate and return the request.
  headSet(key, val: string): Res
  headAppend(key, val: string): Res
  headDelete(key: string): Res
  headMut(src: Headers | Record<string, string>): Res

  // Class used for `.headers`. Can override in subclass.
  get Head(): {new(): Head}

  // Class used for responses. Can override in subclass.
  get Res(): {new(): Res; static from(res: Response): Res}
}
```

### `class Res`

Subclass of `Response` with additional shortcuts for response handling. Always wraps a native response received from another source. [#`Req`](#class-req) automatically uses this for responses. You don't need to construct this.

```ts
class Res extends Response {
  // Reference to the wrapped response.
  res: Response

  /*
  Same as the native constructor, but takes an additional response reference
  to wrap. Defers the following getters to the original:

    get redirected
    get type
    get url
  */
  constructor(body?: BodyInit | null, init?: ResponseInit, res: Response)

  /*
  If `res.ok`, returns the response as-is. Otherwise throws an instance of
  `Err` with the status code and response text in its error message.
  */
  okRes(): Promise<Res>

  /*
  Shortcut for `(await this.okRes()).text()`. On unsuccessful response,
  throws a descriptive error. On success, returns response text.
  */
  okText(): Promise<string>

  /*
  Shortcut for `(await this.okRes()).json()`. On unsuccessful response,
  throws a descriptive error. On success, returns decoded JSON.
  */
  okJson(): Promise<any>

  // Class used for response errors. Can override in subclass.
  get Err(): {new(): Err}

  // Shortcut for constructing from another response.
  static from(res: Response): Res
}
```

### `class Head`

Subclass of `Headers` with additional shortcuts. Used internally by [`Req`](#class-req).

```ts
class Head extends Headers {
  /*
  Merges the headers from the given source into the receiver. Mutates and
  returns the same reference.
  */
  mut(src: Headers | Record<string, string>): Head

  /*
  Overrides `Headers.prototype.set` to return the same reference, instead of
  void. Also asserts input types.
  */
  set(key, val: string): Head

  /*
  Overrides `Headers.prototype.append` to return the same reference, instead of
  void. Also asserts input types.
  */
  append(key, val: string): Head

  /*
  Similar to `.set`, but does nothing if the key is already present, or if the
  value is empty.
  */
  setOpt(key: string, val?: string): Head

  /*
  Similar to `Set.prototype.clear`. Removes all content. Mutates and returns
  the same reference.
  */
  clear(): Head
}
```

### `function jsonDecode`

Sanity-checking wrapper for [`JSON.parse`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse). If the input is nil or an empty string, returns `null`. Otherwise the input must be a primitive string. Throws on other inputs, without trying to stringify them.

### `function jsonEncode`

Sanity-checking wrapper for [`JSON.stringify`](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/stringify). Equivalent to `JSON.stringify(val ?? null)`. If the input is `undefined`, returns `'null'` (string) rather than `undefined` (nil). Output is _always_ a valid JSON string.

### Undocumented

Some APIs are exported but undocumented to avoid bloating the docs. Check the source files and look for `export`.

## Changelog

### 0.15.3

Add `Head..setOpt`, `Res..Err`. Minor bugfixes.

### 0.15.2

Bugfix for previous version.

### 0.15.1

Add `req` shortcut.

### 0.15.0

Full revision.

* Now provides shortcuts for `fetch` and other built-ins.
* Now provides only 1 module for all environments.
* No longer uses Node APIs.
* No longer uses `XMLHttpRequest`.

## License

https://unlicense.org

## Misc

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
