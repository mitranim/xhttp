## Overview

`xhttp` is a pair of lightweight libraries for making HTTP requests in Node.js
and browsers.

**This readme is for the Node library only.** For the browser version, see
[readme.md](readme.md).

Not isomorphic, at least not yet. Has different APIs for Node and browser.

## Overview: Node Library

Toolkit for making HTTP requests in Node.js. More convenient than the stdlib,
more lightweight than popular alternatives.

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
* [Misc](#misc)

## Why

* Lightweight: ≈250+ LOC, very few dependencies
* Convenient:
  * avoids callbacks and events, provides a promise/future API
  * retains access to streaming
  * provides response metadata in usable format
  * has a convenient high level API
* Efficient (few layers of crap)

### Why not `request`

`request` is a popular HTTP library for Node.js. It has a baroque API that
requires a custom wrapper just to make it usable. It fails to provide response
metadata in a usable format (see [Response](#response)). It fails to provide a
promise/future API. Despite that, it manages to have so many dependencies that
it takes 100 ms to start up on my machine. Unhealthy.

## Installation

Shell:

```sh
npm install --exact xhttp
```

Node:

```js
const {/* ... */} = require('xhttp/node')
```

Note: for Node.js, you must import from **`xhttp/node`**, not `xhttp`.

## Usage

(For cancelation, see below.)

High-level API. Will buffer and stringify the response, and produce an error if
the response code is not between 200 and 299:

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

Simple JSON request; encodes request, adds headers, tries to decode response:

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

Lower level:

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

With streaming:

```js
const {streamingRequest} = require('xhttp/node')

async function main() {
  const {ok, status, statusText, headers, stream} = await streamingRequest({
    url: '<some url>',
    method: 'POST',
    body: fs.createReadStream('<data file>'),
  })
  stream.pipe(process.stdout)
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
type Params {
  url: string,
  method: ?string,
  headers: ?{[string]: string},
  timeout: ?number,
  body: ?Stream|Buffer|string,
}
```

### Response

Response format:

```ts
type Response {
  // True if status is between 200 and 299
  ok: boolean,
  status: string,
  statusText: string,
  // One of: 'load' | 'timeout' | 'aborted'
  reason: string,
  headers: ?{[string]: string},
  stream: ?ReadableStream,
  body: ?Buffer|string,
  params: Params,
}
```

`streamingRequest` resolves to a response that contains the Node.js response
object as `response.stream`.

`bufferedRequest`, `httpRequest`, `jsonRequest`, and `bufferBody` resolve to a
response that contains a `response.body`.

### `httpRequest(params)`

High-level API. Takes [Params](#request-params) and returns a [future](#futures)
that eventually resolves to a [Response](#response) that contains a
`response.body` as a string.

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
contains a `response.body`, possibly decoded from JSON.

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

Mid-level API. Takes [Params](#request-params) and returns a [future](#futures)
that eventually resolves to a [Response](#response) that contains a
`response.body` as a `Buffer`.

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
eventually resolves to a [Response](#response) that contains the Node.js
response as `response.stream`.

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
  const {ok, status, statusText, headers, stream} = await streamingRequest({
    url: '<some url>',
    body: fs.createReadStream('<data file>'),
  })
  stream.pipe(process.stdout)
}
```

Cancelation:

```js
const req = streamingRequest(params)
req.deinit()
```

### `bufferBody(response)`

Takes a [Response](#response) returned by `streamingRequest` and returns a
future that eventually resolves to a Response that contains a fully buffered
`response.body` as a `Buffer`. Using `.setEncoding()` on the Node response
causes it to be buffered as a string.

```js
const {streamingRequest, bufferBody} = require('xhttp/node')

streamingRequest(params).mapResult(bufferBody).mapResult(response => {
  const {ok, status, statusText, headers, body} = response
})
```

### `stringifyBody(response)`

Takes a [Response](#response) returned by `bufferBody` and coerces
`response.body` to a string.

```js
const {streamingRequest, bufferBody, stringifyBody} = require('xhttp/node')

streamingRequest(params).mapResult(bufferBody).mapResult(stringifyBody).mapResult(response => {
  const {ok, status, statusText, headers, body} = response
})
```

### `okErr(response)`

Takes a [Response](#response) and returns a future that produces an error if the
HTTP status code is not between 200 and 299.

The resulting `HttpError` contains the original response as `error.response`.

```js
const {streamingRequest, okErr, HttpError} = require('xhttp/node')

streamingRequest(params).mapResult(okErr).map((error, response) => {
  if (error instanceof HttpError) {
    const {ok, status, statusText, headers, body} = error.response
  }
  else if (error) console.error(error)
  else console.info(response)
})
```

### `isResponse(value)`

True if `value` looks like a [Response](#response). Doesn't care if the response
is streaming or buffered.

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

## Misc

The library is new. Might have bugs and edge cases, might be missing some
common functionality.
