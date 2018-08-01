## Overview

`xhttp` is a pair of lightweight libraries for making HTTP requests in Node.js
and browsers.

**This readme is for the browser library only.** For the Node.js version, see
[readme-node.md](readme-node.md).

Not isomorphic: has different APIs for Node and browsers.

## Overview: Browser Library

Toolkit for `XMLHttpRequest`, the browser API for making HTTP requests. Makes it practical and convenient to use.

Difference from other similar libraries:
  * keeps the `XMLHttpRequest` object accessible
  * no premature branching: one callback with one argument
  * doesn't mandate promises (easy to add)

Small (≈220 LoC) and dependency-free. Compatible with IE9+.

## TOC

* [Why](#why)
* [Installation](#installation)
* [API](#api)
  * [`Xhttp`](#xhttpparams-fun)
  * [Params](#params)
  * [Response](#response)
  * [Encoding and Parsing](#encoding-and-parsing)
  * [Misc Utils](#misc-utils)
* [Cancelation](#cancelation)
* [Promises](#promises)
* [Changelog](#changelog)
* [Misc](#misc)

## Why

### Why bother?

Most ajax libraries make the same mistakes `jQuery.ajax` did, plus more:

  * losing access to the `XMLHttpRequest`
  * premature branching into multiple callbacks
  * one huge over-configurable function instead of a toolkit
  * multiple arguments instead of one result
  * unnecessary "middleware" callbacks

JavaScript forces callbacks for asynchonous actions. This alone is bad enough. _Multiple_ callbacks for one action borders on masochism. It causes people to invent additional "finally"-style callbacks just to hack around the fact they have branched prematurely. `xhttp` lets you have a single callback (see [`Xhttp`](#xhttpparams-fun)). One continuation is better than many; it's never too late to branch!

Other libraries spread results over multiple arguments (body, xhr etc.). `xhttp` bundles it all into a single value (see [Response](#response)), which is convenient for further API adaptations. Adding a [Promise-based](#promises) API becomes trivial.

Many libraries make another big mistake: losing a reference to the underlying `XMLHttpRequest` object, hiding it behind callbacks or a promise. `xhttp` keeps you in control by never hiding the xhr object.

### Why not `fetch`?

(`fetch` is a recently standardised alternative to `XMLHttpRequest`.)

`fetch` is fundamentally broken because it gives you a promise instead of a reference to the HTTP task, hiding a rich, manageable reference behind ephemeral callbacks. As a result, it lacks such vital features as:

  * upload / download progress
  * ability to abort

It has only one real advantage over `XMLHttpRequest`: streaming the response instead of buffering it all in memory, but this is irrelevant for most uses, and will probably get bolted onto `XMLHttpRequest` some day.

## Installation

```sh
npm install --exact xhttp
```

Requires a module bundler such as Webpack or Rollup. Available in ES2015 and CommonJS formats; your bundler should automatically pick the appropriate one.

```js
import {Xhttp} from 'xhttp'
```

## API

### `Xhttp(params, fun)`

Starts a request and returns the `XMLHttpRequest` object. The params must be a dictionary following the [Params](#params) format. When the request ends _for any reason_, the callback receives a [`Response`](#response) dictionary.

```js
import * as xhttp from 'xhttp'

const xhr = xhttp.Xhttp({url: '/'}, ({ok, status, reason, headers, body}) => {
  if (ok) console.info('Success:', body)
  else console.warn('Failure:', body)
})
```

Note: there's no "success" or "failure" callbacks. You can branch based on the `status` code, the `reason` the request was stopped, or the shorthand `ok` which means `reason === 'load'` and `status` between 200 and 299.

If you're doing something less common, such as sending and receiving binary data, or tracking upload / download progress, you're meant to re-assemble an alternative to `Xhttp` using the provided lower-level functions. Example:

```js
import * as xhttp from 'xhttp'

export function binaryXhr(params, fun) {
  const xhr = new XMLHttpRequest()
  xhr.responseType = 'arraybuffer'
  xhttp.start(xhr, xhttp.transformParams(params), function onXhrDone(event) {
    const response = xhttp.eventToResponse(event)
    response.body = xhr.response
    fun(response)
  })
  return xhr
}

const xhr = binaryXhr({url: '/'}, ({ok, body}) => {/* ... */})
```

See [Misc Utils](#misc-utils) for more examples.

### Params

The expected structure of the configuration dictionary passed to `xhttp` functions such as [`Xhttp`](#xhttpparams-fun).

```ts
interface Params {
  // Required. For GET and HEAD, `Xhttp` and `transformParams` automatically
  // form-encode the body and append it to the url. See Encoding and Parsing.
  url: string

  method: ?string
  headers: ?{[string]: string}

  // `Xhttp` and `transformParams` may automatically encode this, depending
  // on method and headers. See Encoding and Parsing.
  body: any

  username: ?string
  password: ?string
}
```

### Response

This structure is passed to the [`Xhttp`](#xhttpparams-fun) callback. Can be created manually by calling [`eventToResponse`](#eventtoresponseevent) on any `XMLHttpRequest` event.

```ts
interface Response {
  // True if `reason` is 'load' and `status` is between 200 and 299
  ok: boolean
  status: number
  statusText: string

  // Response headers, with lowercased keys
  headers: {[string]: string}

  // Response body, possibly decoded; see Encoding and Parsing.
  // Response from `eventToResponse` DOES NOT include a body.
  body: any

  // The DOM event that fired at the end of the request.
  // The event type is duplicated as `reason`, see below.
  event: Event

  // The type of the DOM event that fired at the end of the request.
  // One of:
  //   'abort'    -- request was aborted
  //   'error'    -- network error (DNS failure, loss of connection, etc.)
  //   'load'     -- request ended successfully
  //   'timeout'  -- request timed out
  reason: string

  // Parsed request params
  params: Params

  // Unix timestamp in milliseconds
  completedAt: number

  xhr: XMLHttpRequest
}
```

### Encoding and Parsing

`xhttp` automatically encodes and decodes some common formats, depending on method, request headers, and response headers.

If the method is read-only (GET, HEAD or OPTIONS) and the body is a plain dict, it's automatically formdata-encoded and appended to the URL as "search" after `?`.

If the method is _not_ read-only:

  * If the headers specify the JSON content type (`application/json`) and the body is a plain dict or list, it's automatically JSON-encoded. Primitives and special objects are passed unchanged.

  * If the headers specify the formdata content type (`application/x-www-form-urlencoded`) and the body is a plain dict, it's automatically formdata-encoded.

If the `content-type` header in the _response_ contains `application/json`, the response body is automatically JSON-parsed. Otherwise it's returned as a string. (Note: prior to `0.8.0` it also parsed XML and HTML into DOM structures; not anymore.)

Pay attention to your headers. You may want to write a tiny wrapper to add default headers to all your requests.

### Misc Utils

`xhttp` exports a few building blocks for re-assembling a custom version of `Xhttp`.

Suppose you want to track upload / download progress. It's not worth doing in every request, so you'll probably want a separate function:

```js
import {
  transformParams,
  start,
  eventToResponse,
  getResponseBody,
} from 'xhttp'

export function trackingHttpRequest(params, onDone, onUpload, onDownload) {
  const xhr = new XMLHttpRequest()
  params = transformParams(params)

  start(xhr, transformParams(params), event => {
    const response = eventToResponse(event)
    response.body = getResponseBody(xhr)
    onDone(response)
  })

  xhr.upload.onprogress = onUpload
  xhr.onprogress = onDownload

  return xhr
}
```

`xhttp` exports a few even lower-level functions, which are not documented here. If you're going that deep, you're probably more likely to use the native APIs or read the source.

#### `transformParams(params)`

Takes a [Params](#params) dictionary and returns a well-formed version of it, possibly encoding the body and/or URL. Should be used for a custom version of `Xhttp`. See the example above.

#### `start(xhr, params, fun)`

Starts an existing `XMLHttpRequest` object, using the provided params.

Note: this doesn't transform the params **or** create a response. When the request ends, `fun` is called with the DOM event that fired. You're meant to convert it to a [Response](#response) using [`eventToResponse`](#eventtoresponseevent), or whatever you please. See the example above.

#### `eventToResponse(event)`

Takes a DOM event that fired on an `XMLHttpRequest` object and creates a [Response](#response). Doesn't attempt to read the body, since there's more than one way to do it. See the example above.

#### `abort(xhr)`

Request cancelation. Same as `xhr.abort()`, but safe to call on nonsense values like `null` or `undefined` without causing an exception.

#### `abortSilently(xhr)`

Same as `abort`, but removes the `onabort` listener, if any, before aborting.

```js
const xhr = xhttp.Xhttp({url: '/'}, response => {})

// This triggers the callback
xhr.abort()

// This doesn't
xhttp.abortSilently(xhr)
```

## Cancelation

`XMLHttpRequest` can be canceled by calling `.abort()`:

```js
const xhr = new XMLHttpRequest()
xhr.open('get', '/')
xhr.send()
xhr.abort()
```

`Xhttp` also attaches an `onabort` event listener. To abort without triggering the callback, remove it first, or use the `abortSilently` function:

```js
const xhr = xhttp.Xhttp({url: '/'}, response => {})

xhr.onabort = null
xhr.abort()

// Same as above
xhttp.abortSilently(xhr)
```

## Promises

To use `XMLHttpRequest` with promises, write your own adapter:

```js
import * as xhttp from 'xhttp'

export function httpRequest(params) {
  let resolve
  const promise = new Promise(x => {resolve = x})
  const xhr = xhttp.Xhttp(params, resolve)
  xhr.promise = promise
  return xhr
}

httpRequest({url: '/'}).promise.then(response => {
  // ...
})
```

Branch into `then/catch` if you want:

```js
import * as xhttp from 'xhttp'

export function httpRequest(params) {
  let resolve
  let reject

  const promise = new Promise((a, b) => {
    resolve = a
    reject = b
  })

  const xhr = xhttp.Xhttp(params, response => {
    if (response.ok) resolve(response)
    else reject(response)
  })
  xhr.promise = promise
  return xhr
}

httpRequest({url: '/'}).promise
  .then(response => {/* ... */})
  .catch(response => {/* ... */})
```

If you want promises with cancelation, consider futures from the [Posterus library](https://github.com/Mitranim/posterus):

```js
import * as xhttp from 'xhttp'
import {Future} from 'posterus'

export function httpRequest(params) {
  const future = new Future()
  const xhr = xhttp.Xhttp(params, response => {
    if (response.ok) future.settle(null, response)
    else future.settle(response)
  })
  return future.finally(error => {
    if (error) {
      xhr.onabort = null
      xhr.abort()
    }
  })
}

httpRequest(params)
  .mapResult(response => {/* ... */})
  .mapError(error => {/* ... */})
  // produces an error, running the .finally callback and aborting
  .deinit()
```

## Changelog

### 0.11.0

See [readme-node.md#changelog](readme-node.md#changelog).

### 0.10.0

See [readme-node.md#changelog](readme-node.md#changelog).

### 0.8.0 → 0.9.0

Breaking cleanup in the browser version. Renamed/replaced most lower-level utils (that nobody ever used) to simplify customization. See the Misc Utils section for the new examples. The main `Xhttp` function works the same way, so most users shouldn't notice a difference.

## Misc

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
