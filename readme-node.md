## Overview

`xhttp` is a pair of lightweight libraries for making HTTP requests in Node.js
and browsers.

**This readme is for the Node library only.** For the browser version, see
[readme.md](readme.md).

Not isomorphic: has different APIs for Node and browsers.

## Overview: Node Library

Toolkit for making HTTP requests in Node.js. More convenient than stdlib,
more lightweight than the popular alternatives.

## TOC

* [Why](#why)
* [Installation](#installation)
* [Usage](#usage)
* [API](#api)
  * [`Request Params`](#request-params)
  * [`Response`](#response)
  * [`httpRequest`](#httprequestparams)
  * [`jsonRequest`](#jsonrequestparams)
  * [`bufferedRequest`](#bufferedrequestparams)
  * [`streamingRequest`](#streamingrequestparams)
  * [`bufferBody`](#bufferbodyresponse)
  * [`stringifyBody`](#stringifybodyresponse)
  * [`okErr`](#okerrresponse)
  * [`isResponse`](#isresponsevalue)
* [Futures](#futures)
* [Changelog](#changelog)
* [Misc](#misc)

## Why

* Lightweight: <300 LOC, very minimal dependencies
* Convenient:
  * has a convenient high level API
  * avoids callbacks and events, provides a promise/future API
  * retains access to streaming APIs
  * provides response metadata in a usable format
* Efficient: few layers of crap

### Why not `request`

`request` is a popular HTTP library for Node.js. It has a baroque API that
requires a custom wrapper just to make it usable. It fails to provide response
metadata in a usable format (see [Response](#response)). It fails to provide a
promise/future API. Despite that, it manages to have so many dependencies that
it takes 100 ms to start up on my machine. Very unhealthy.

## Installation

Shell:

```sh
npm install --exact xhttp
```

Node:

```js
const {/* ... */} = require('xhttp/node')
```

For Node.js, you must import from **`xhttp/node`**, not `xhttp`.

## Usage

(For cancelation, see below.)

Use `httpRequest` for plain text requests. Will buffer and stringify the
response, and produce an exception if the response code is not between 200 and
299:

```js
const {httpRequest} = require('xhttp/node')

async function main() {
  try {
    const response = await httpRequest({url: '<some url>'})
    const {ok, status, statusText, headers, body} = response
  }
  catch (err) {
    const {message, stack, ok, status, statusText, headers, body} = err
  }
}
```

Use `jsonRequest` for basic JSON requests. Encodes request, adds headers, tries
to decode response:

```js
const {jsonRequest} = require('xhttp/node')

async function main() {
  const response = await jsonRequest({
    url: '<some url>',
    body: {key: 'value'},
  })
  // If the endpoint responds with JSON, the body is decoded
  const {body} = response
}
```

Use `bufferedRequest` for binary requests. It deals with byte `Buffer`s:

```js
const {bufferedRequest} = require('xhttp/node')

async function main() {
  const {ok, status, statusText, headers, body} = await bufferedRequest({
    url: '<some url>',
    method: 'POST',
    body: fs.createReadStream('<data file>'),
  })
}
```

`streamingRequest` is the underlying tool used by other functions. It doesn't
buffer or coerce responses:

```js
const {streamingRequest} = require('xhttp/node')

async function main() {
  const {ok, status, statusText, headers, body} = await streamingRequest({
    url: '<some url>',
    method: 'POST',
    body: fs.createReadStream('<data file>'),
  })
  body.pipe(process.stdout)
}
```

Cancelation:

```js
const req = streamingRequest(params)
req.deinit()
```

See [Futures](#futures) for explanation.

## API

### Request Params

Request params format:

```ts
interface Params {
  url: string
  method: ?string
  headers: ?{[string]: string}
  timeout: ?number
  body: ?Stream|Buffer|string
}
```

### Response

Response format:

```ts
interface Response {
  // True if status is between 200 and 299
  ok: boolean
  status: string
  statusText: string
  // One of: 'load' | 'timeout' | 'aborted'
  reason: string
  // Response headers, with lowercased keys
  headers: {[string]: string}
  body: ?(ReadableStream|Buffer|string)
  params: Params
}
```

`streamingRequest` resolves to a Response where `.body` is a Node readable stream.

`bufferedRequest`, `httpRequest`, `jsonRequest`, and `bufferBody` resolve to a Response where `.body` is a fully realized `Buffer` or string.

### `httpRequest(params)`

High-level API. Takes [Params](#request-params) and returns a [future](#futures) that eventually resolves to a [Response](#response) that contains the response body, coerced to a string, as `.body`.

Will automatically:
  * buffer response
  * convert response from `Buffer` to string
  * coerce to error if response status code is not between 200 and 299

```js
const {httpRequest} = require('xhttp/node')

async function main() {
  try {
    const response = await httpRequest({url: '<some url>'})
    const {ok, status, statusText, headers, body} = response
  }
  catch (err) {
    const {message, stack, ok, status, statusText, headers, body} = err
  }
}
```

Defined in terms of `bufferedRequest` and other utils:

```js
const {bufferedRequest, stringifyBody, okErr} = require('xhttp/node')

function httpRequest(params) {
  return bufferedRequest(params).mapResult(stringifyBody).mapResult(okErr)
}
```

### `jsonRequest(params)`

High-level API for JSON requests. Takes [Params](#request-params) and returns a
[future](#futures) that eventually resolves to a [Response](#response) that
contains the response body, possibly decoded from JSON, as `.body`.

Will automatically:
  * encode `params.body` as JSON
  * add JSON headers
  * decode `response.body` if _response_ headers indicate JSON content type

```js
const {jsonRequest} = require('xhttp/node')

async function main() {
  const response = await jsonRequest({
    url: '<some url>',
    body: {key: 'value'},
  })
  // If the some url responds with JSON, body is decoded
  const {body} = response
}
```

Defined in terms of `bufferedRequest` and other utils:

```js
const {bufferedRequest, toJsonParams, stringifyBody, maybeParseBody, okErr} = require('xhttp/node')

function jsonRequest(params) {
  return bufferedRequest(toJsonParams(params))
    .mapResult(stringifyBody)
    .mapResult(maybeParseBody)
    .mapResult(okErr)
}
```

### `bufferedRequest(params)`

Mid-level API. Takes [Params](#request-params) and returns a [future](#futures) that eventually resolves to a [Response](#response) that contains the response body, as a byte `Buffer`, as `.body`.

Usage:

```js
const {bufferedRequest} = require('xhttp/node')

async function main() {
  const response = await bufferedRequest({url: '<some url>'})
  const {ok, status, statusText, headers, body} = response
}
```

Definition:

```js
const {streamingRequest, bufferBody} = require('xhttp/node')

function bufferedRequest(params) {
  return streamingRequest(params).mapResult(bufferBody)
}
```

### `streamingRequest(params)`

Core API. Takes [Params](#request-params) and returns a [future](#futures) that
eventually resolves to a [Response](#response) where `.body` is a Node readable stream.

Will automatically handle request and response lifecycles, which are normally a
pain to get right.

Will accept `params.body` as `Stream|Buffer|string` and send it automatically.

Will **not**:
  * buffer response stream
  * coerce to error based on HTTP status code

Basic usage:

```js
const {streamingRequest} = require('xhttp/node')

async function main() {
  const {ok, status, statusText, headers, body} = await streamingRequest({
    url: '<some url>',
    body: fs.createReadStream('<data file>'),
  })
  body.pipe(process.stdout)
}
```

Cancelation:

```js
const req = streamingRequest(params)
req.deinit()
```

### `bufferBody(response)`

Takes a [Response](#response) returned by `streamingRequest` and returns a future that eventually resolves to a Response where `.body` is a fully realized `Buffer` rather than a stream. Using `.setEncoding()` on the readable stream before buffering causes it to be buffered as a string using the given encoding.

```js
const {streamingRequest, bufferBody} = require('xhttp/node')

streamingRequest(params)
  .mapResult(bufferBody)
  .mapResult(response => {
    const {ok, status, statusText, headers, body} = response
  })
```

### `stringifyBody(response)`

Takes a [Response](#response) returned by `bufferBody` and coerces its `.body`
to a string.

```js
const {streamingRequest, bufferBody, stringifyBody} = require('xhttp/node')

streamingRequest(params)
  .mapResult(bufferBody)
  .mapResult(stringifyBody)
  .mapResult(response => {
    const {ok, status, statusText, headers, body} = response
  })
```

### `okErr(response)`

Takes a [Response](#response) and returns a future that produces an error if the HTTP status code is not between 200 and 299.

The resulting `HttpError` contains the original response as `error.response`.

```js
const {streamingRequest, okErr, HttpError} = require('xhttp/node')

streamingRequest(params)
  .mapResult(okErr)
  .map((error, response) => {
    if (error instanceof HttpError) {
      const {ok, status, statusText, headers, body} = error.response
    }
    else if (error) console.error(error)
    else console.info(response)
  })
```

### `isResponse(value)`

True if `value` looks like a [Response](#response). Doesn't care if the response is streaming or buffered.

```js
const {streamingRequest, isResponse} = require('xhttp/node')

streamingRequest(params).mapResult(response => {
  console.info(isResponse(response))
})
```

## Futures

All async functions in `xhttp` return Posterus futures. See the [Posterus
documentation](https://github.com/Mitranim/posterus). They automatically coerce
to promises, making them compatible with other promises and async/await.

Futures support cancelation. To abort a request, call `.deinit()`:

```js
const req = streamingRequest(params)
req.deinit()
```

They have other benefits, but if you don't care, that's all you need to know.

## Changelog

### 0.8.0 → 0.9.0

Breaking: `Response` no longer has a `.stream` property; in a streaming response, the `.body` is a stream.

`bufferBody` and `stringifyBody` now work on anything with a `.body` and don't require the full `Response` structure.

`bufferBody` consistently returns a future.

## Misc

Currently doesn't support redirects. Every time I _thought_ I needed them, turned out I didn't.

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
