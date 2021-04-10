## Overview

Lightweight library for making HTTP requests in browser and Node, with a mostly-isomorphic API.

Small (a few kilobytes) and dependency-free. Usable as a native JS module. Does _NOT_ rely on polyfills.

## TOC

* [Why](#why)
* [Usage](#usage)
* [API](#api)
  * [Types](#types)
    * [`Params`](#params)
    * [`Response`](#response)
    * [`ResErr`](#reserr)
  * [`req(params)`](#reqparams)
  * [`wait(req)`](#waitreq)
  * [`resNormal(res)`](#resnormalres)
  * [`resOnlyOk(res)`](#resonlyokres)
  * [`resToComplete(res)`](#restocompleteres)
  * [`resToString(res)`](#restostringres)
  * [`resFromJson(res)`](#resfromjsonres)
  * [`paramsToJson(params)`](#paramstojsonparams)
  * [Undocumented](#undocumented)
* [Changelog](#changelog)

## Why

* Native APIs are too low-level and error-prone.
* Other libraries are too bloated.
* `fetch` is crippled by lack of cancelation and upload/download progress. `xhttp` exposes the underlying `XMLHttpRequest` and `http.ClientRequest` objects to make this available.

## Usage

The API is mostly isomorphic between browsers and Node.

```js
import * as h from 'xhttp'

// Elides cancelation for simplicity of example.
function fetchString(params) {
  const req = h.req(params)
  return h.wait(req).then(h.resNormal)
}

// Elides cancelation for simplicity of example.
function fetchJson(params) {
  return fetchString(h.paramsToJson(params)).then(h.resFromJson)
}
```

When using native JS modules in a browser without a bundler, import like this:

```js
import * as h from './node_modules/xhttp/xhttp.mjs'
```

Or like this:

```js
import * as h from 'https://unpkg.com/xhttp@0.14.0/xhttp.mjs'
```

## API

### Types

#### `Params`

Input to [`req(params)`](#reqparams).

If `query` is provided, it's automatically encoded into the URL.

In browsers, `body` must be anything accepted by `XMLHttpRequest.prototype.send`, which includes strings and `FormData` objects. In Node, `body` must be either a readable stream, a string, or a `Buffer`.

```ts
interface Params {
  method?:   string
  url:       string | URL
  query?:    {[string]: any}
  username?: string
  password?: string
  timeout?:  number
  headers?:  {[string]: string}
  body?:     string | Buffer | ReadableStream | FormData
}
````

#### `Response`

Result of a promise returned by [`wait(req)`](#waitreq). Includes the request and original params.

`ok` is true is the HTTP status was between 200 and 299.

`complete` is true if the HTTP request has completed and the response body has been fully downloaded. In Node, [`wait(req)`](#waitreq) resolves to a response where `complete` is false, and requires [`resToComplete(res)`](#restocompleteres) to make it true.

In browsers, `body` is always a string. In Node, `body` is initially a readable stream, which can be buffered via [`resToComplete(res)`](#restocompleteres) into a `Buffer`, or [`resToString(res)`](#restostringres) into a string. Those functions are available in the browser version for symmetry.

```ts
interface Response {
  req:        XMLHttpRequest | http.ClientRequest
  type:       string
  ok:         boolean
  complete:   boolean
  status:     number
  statusText: number
  headers:    {[string]: string}
  body:       string | Buffer | ReadableStream
  params:     Params
}
````

#### `ResErr`

Thrown by functions like [`resOnlyOk(res)`](#resonlyokres). These errors are always opt-in.

```ts
class ResErr extends Error {
  res:        Response
  status:     number
  statusText: string
  message:    string
}
```

### `req(params)`

Creates and immediately starts the request with the given [`Params`](#params). You must immediately attach callbacks via [`wait(req)`](#waitreq).

The request can be used for upload/download progress and cancelation.

```js
const req = h.req({url: 'https://example.com'})
req.abort()
```

### `wait(req)`

Takes a request created by [`req(params)`](#reqparams) and returns a promise that will resolve to a [`Response`](#response).

In Node, in case of networks errors (unreachable host), the promise may fail with an error. Otherwise, it will _always_ resolve to a `Response`, even if the request was aborted, timed out, or the server returned a 400-500 error code.

To filter only "ok" responses, use [`resOnlyOk(res)`](#resonlyokres).

In Node, the response body is a readable stream. For isomorphic behavior, use [`resToString(res)`](#restostringres), available in both environments.

```js
const req = h.req({url: 'https://example.com'})

const res = await h.wait(req)

console.log(res)

// In Node:
res.body.pipe(process.stdout)
```

### `resNormal(res)`

"Normal" request-response: buffers the response body to a string, and ensures that the response has an "ok" status. Otherwise throws a [`ResErr`](#reserr).

Takes and returns a [`Response`](#response), always async. Should be used via `.then()`.

```js
const req = h.req({url: 'https://example.com'})

const res = await h.wait(req).then(h.resNormal)

console.log(res.body)
```

### `resOnlyOk(res)`

Ensures that the response has an "ok" status. Otherwise throws a [`ResErr`](#reserr).

Takes and returns a [`Response`](#response), always sync. Should be used via `.then()`.

```js
// Has a non-"ok" code, but doesn't throw.
const req = h.req({url: 'https://example.com/404'})
const res = await h.wait(req)
console.log(res.status) // 404

// Throws because of `resOnlyOk`.
try {
  const req = h.req({url: 'https://example.com/404'})
  const _ = await h.wait(res).then(h.resOnlyOk)
}
catch (err) {
  console.log(err) // ResErr
}
```

### `resToComplete(res)`

In Node, collects the response body into a single `Buffer` or string. In browsers, this is a noop, provided only for symmetry; `XMLHttpRequest` automatically buffers the response body into a string.

Takes and returns a [`Response`](#response), always async. Should be used via `.then()`.

```js
const req = h.req({url: 'https://example.com'})

const res = await h.wait(req).then(h.resToComplete)

console.log(res.body)
```

### `resToString(res)`

Similar to [`resToComplete(res)`](#restocompleteres). In Node, this buffers the response body into a string (not a `Buffer`). In browsers, this is a noop, provided for symmetry.

Takes and returns a [`Response`](#response), always async. Should be used via `.then()`.

```js
const req = h.req({url: 'https://example.com'})

const res = await h.wait(req).then(h.resToString)

console.log(res.body)
```

### `resFromJson(res)`

Invokes `JSON.parse` on the response body. The body must have been already downloaded via [`resToComplete(res)`](#restocompleteres) or [`resToString(res)`](#restostringres). Should be used for _receiving_ JSON. For _sending_ JSON, use [`paramsToJson(params)`](#paramstojsonparams).

Takes and returns a [`Response`](#response), always sync. Must be preceded by body buffering. Should be used via `.then()`.

```js
const req = h.req({url: '/api/some-json-endpoint'})

const res = await h.wait(req)
  .then(h.resToComplete)
  .then(h.resFromJson)

console.log(res.body)
```

### `paramsToJson(params)`

Invokes `JSON.stringify` on the request body, and adds the appropriate `content-type` header. Should be used for _sending_ JSON. For _receiving_ JSON, use [`resFromJson(res)`](#resfromjsonres).

Takes and returns [`Params`](#params).

```js
const req = h.req(h.paramsToJson({
  url: '/api/some-json-endpoint',
  method: 'post',
  body: {key: 'val'},
}))
```

### Undocumented

Many utility functions are exported but undocumented. Peruse the source, looking for `export`.

## Changelog

### 0.14.0

Minor breaking changes in the name of simplicity and consistency:

* In browsers, the following functions now _always_ return promises, for consistency with Node: `resNormal`, `resToComplete`, `resToString`.

* The undocumented function `urlWithQuery` now always returns a `URL` object, rather than a string. The input `url` may be a string or another `URL` (not mutated).

* Library reduction:

  * Removed undocumented: `queryFormat`, `urlJoin`, `urlBase`, `urlSearch`, `urlHash`.

  * Use the native `URL` and `URLSearchParams` interfaces for URL decoding and encoding. (No change in the documented `Params` API; `url` and `query` work the same as before.)

Reduced the unminified size of both files by ≈1 KiB (browser to 6 KiB, Node to 8 KiB).

### 0.13.2

Revert one of the breaking changes in `0.13.0`: headers are once again called `headers`, rather than `head`, for consistency with Node's convention.

### 0.13.1

Query formatting improvements:

* Machine-readable date encoding via `Date.prototype.toISOString`, producing strings like `0001-02-03T04:05:06.000Z`.
* Reject non-string query keys.
* Nil query values are encoded as `''`.
* Other non-primitive query values are rejected with an exception.

### 0.13.0

Breaking:

* The API has been revised, simplified, and made mostly isomorphic between browsers and Node.

* Uses promises to simplify response transformation. Still exposes the underlying request objects, allowing progress tracking and cancelation.

* Provided _only_ as native JS modules. Not compatible with IE or `require`.

Minor improvements:

* Supports lists in queries and headers.

* The Node version is now dependency-free.

### 0.12.0

**Browser**:

Breaking:

* renamed `Xhttp` → `request`

* `request` and `transformParams` no longer treat `body` as query params for read-only requests. Now you explicitly pass `params.query` instead. This works for all HTTP methods, not just GET/HEAD/OPTIONS as before.

* Automatic query encoding no longer omits values with empty strings, but does still omit `null` or `undefined` values.

**Node**:

Params now accept a dict of query parameters that are automatically formdata-encoded and appended to the URL:

```
xhttp.bufferedRequest({
  url: 'https://google.com/search',
  query: {q: 'test'},
}, (err, response) => {
  // ...
})
```

This makes a request to `https://google.com/search?q=test`.

### 0.11.0

**Node**:

Breaking: removed futures and the Posterus dependency. The API is now callback-based. The user is expected to add promises/futures/observables/etc. by themselves. This makes us more flexible and lightweight.

### 0.10.0

**Node**:

Minor but breaking cleanup.

  * renamed `httpRequest` → `textRequest`
  * renamed `okErr` → `httpError`
  * `textRequest` and `jsonRequest` no longer implicitly use `httpError` to throw on non-200+ responses
  * an aborted response now has `.reason = 'abort'`, not `.reason = 'aborted'` for mental consistency with its counterpart in the browser library

Also updated dependencies.

### 0.8.0 → 0.9.0

**Browser**:

Breaking cleanup. Renamed/replaced most lower-level utils (that nobody ever used) to simplify customization. See the Misc Utils section for the new examples. The main `Xhttp` function works the same way, so most users shouldn't notice a difference.

**Node**:

Breaking: `Response` no longer has a `.stream` property; in a streaming response, the `.body` is a stream.

`bufferBody` and `stringifyBody` now work on anything with a `.body` and don't require the full `Response` structure.

`bufferBody` consistently returns a future.

## License

https://unlicense.org

## Misc

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
