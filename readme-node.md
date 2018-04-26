## Overview

`xhttp` is a pair of lightweight libraries for making HTTP requests in Node.js
and browsers.

**This readme is for the Node library only.** For the browser version, see
[readme.md](readme.md).

Not isomorphic: has different APIs for Node and browsers.

## Overview: Node Library

Toolkit for making HTTP requests in Node.js. **Much** more convenient than the standard `http` module, **much** more lightweight than the popular alternatives.

## TOC

* [Why](#why)
* [Installation](#installation)
* [Usage](#usage)
* [API](#api)
  * [`Request Params`](#request-params)
  * [`Response`](#response)
  * [`streamingRequest`](#streamingrequestparams)
  * [`bufferedRequest`](#bufferedrequestparams)
  * [`textRequest`](#textrequestparams)
  * [`jsonRequest`](#jsonrequestparams)
  * [`bufferBody`](#bufferbodyresponse)
  * [`stringifyBody`](#stringifybodyresponse)
  * [`httpError`](#httperrorresponse)
  * [`isResponse`](#isresponsevalue)
* [Futures](#futures)
* [Changelog](#changelog)
* [Misc](#misc)

## Why

* Lightweight: <300 LoC, very minimal dependencies
* Convenient:
  * nice high level API, mostly futures/promises
  * retains access to streaming APIs
  * usable format for response metadata
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
npm i -E xhttp
# or
yarn add -E xhttp
```

Node:

```js
const {/* ... */} = require('xhttp/node')
```

For Node.js, you must import from **`xhttp/node`**, not `xhttp`.

## Usage

Basic request, with response as stream:

```js
const xhttp = require('xhttp/node')

async function main() {
  const response = await xhttp.streamingRequest({url: '<some url>'})
  const {ok, status, statusText, headers, body} = response
  // body is a stream and hasn't been fully downloaded yet
  body.pipe(process.stdout)
}
```

Other request functions pre-buffer the response:

```js
const response = await xhttp.bufferedRequest({url: '<some url>'})
const {body} = response
// body is a Buffer

const response = await xhttp.textRequest({url: '<some url>'})
const {body} = response
// body is a string

const response = await xhttp.jsonRequest({url: '<some url>'})
const {body} = response
// body is parsed from JSON, if possible
```

Each request function can send a stream, a byte buffer, or a string:

```js
xhttp.textRequest({
  url: '...',
  method: 'post',
  body: fs.createReadStream('some-file'),
})

xhttp.textRequest({
  url: '...',
  method: 'post',
  body: Buffer.from('hello world!'),
})

xhttp.textRequest({
  url: '...',
  method: 'post',
  body: 'hello world!',
})
```

Use [`httpError`](#httperrorresponse) to produce an exception if the request ended with a non-ok HTTP code:

```js
xhttp.textRequest({})
  .then(xhttp.httpError)
  .catch(error => {
    const {response} = error
  })
```

Responses can be consumed as promises:

```js
xhttp.textRequest({})
  .then(response => {})
  .catch(error => {})

async function main() {
  try {
    const response = await xhttp.textRequest({})
  }
  catch (err) {
    // ...
  }
}
```

They're actually futures from the [Posterus](https://github.com/Mitranim/posterus) library, and support cancelation:

```js
const future = xhttp.textRequest({})
  .mapResult(response => {})
  .mapError(error => {})

const future = xhttp.textRequest({})
  .map((error, response) => {})

future.deinit()
```

See [Futures](#futures) for an explanation.

## API

### Request Params

You pass this to the request functions:

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

Requests return this:

```ts
interface Response {
  // True if status is between 200 and 299
  ok: boolean
  status: string
  statusText: string
  // One of: 'load' | 'timeout' | 'abort'
  reason: string
  // Response headers, with lowercased keys
  headers: {[string]: string}
  body: ?(ReadableStream|Buffer|string)
  params: Params
}
```

### `streamingRequest(params)`

Core API. Takes [Params](#request-params) and returns a [future](#futures) that eventually resolves to a [Response](#response) where `.body` is a Node readable stream.

Will automatically handle request and response lifecycles, which are normally a pain to get right.

`params.body` can be a stream, a buffer, or a string. `response.body` is always a stream.

Basic usage:

```js
const {streamingRequest} = require('xhttp/node')

async function main() {
  const response = await streamingRequest({url: '<some url>'})
  const {ok, status, statusText, headers, body} = response
  body.pipe(process.stdout)
}
```

Cancelation:

```js
const future = streamingRequest(params)
future.deinit()
```

### `bufferedRequest(params)`

Mid-level API. Takes [Params](#request-params) and returns a [future](#futures) that eventually resolves to a [Response](#response) where `response.body` is a Node `Buffer` (raw bytes).

Usage:

```js
const {bufferedRequest} = require('xhttp/node')

async function main() {
  const response = await bufferedRequest({url: '<some url>'})
  const {ok, status, statusText, headers, body} = response
}
```

Defined in terms of `streamingRequest`:

```js
const {streamingRequest, bufferBody} = require('xhttp/node')

function bufferedRequest(params) {
  return streamingRequest(params).mapResult(bufferBody)
}
```

### `textRequest(params)`

High-level API. Takes [Params](#request-params) and returns a [future](#futures) that eventually resolves to a [Response](#response) where `response.body` is fully buffered and converted to a string.

```js
const {textRequest} = require('xhttp/node')

async function main() {
  const response = await textRequest({url: '<some url>'})
  const {ok, status, statusText, headers, body} = response
}
```

Defined in terms of `bufferedRequest`:

```js
const {bufferedRequest, stringifyBody} = require('xhttp/node')

function textRequest(params) {
  return bufferedRequest(params).mapResult(stringifyBody)
}
```

### `jsonRequest(params)`

High-level API for JSON requests. Takes [Params](#request-params) and returns a [future](#futures) that eventually resolves to a [Response](#response) where `response.body` is fully buffered, and decoded from JSON if possible.

Always encodes `params.body` as JSON. Decodes the response body only if the response headers specify the `application/json` content type.

```js
const {jsonRequest} = require('xhttp/node')

async function main() {
  const response = await jsonRequest({
    url: '<some url>',
    body: {key: 'value'},
  })
  // If the response content type is JSON, body is decoded
  const {body} = response
}
```

Defined in terms of `textRequest`:

```js
const {textRequest, toJsonParams, maybeParseBody} = require('xhttp/node')

function jsonRequest(params) {
  return textRequest(toJsonParams(params)).mapResult(maybeParseBody)
}
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

Takes a [Response](#response) returned by `bufferBody` and coerces its `.body` to a string.

```js
const {streamingRequest, bufferBody, stringifyBody} = require('xhttp/node')

streamingRequest(params)
  .mapResult(bufferBody)
  .mapResult(stringifyBody)
  .mapResult(response => {
    const {ok, status, statusText, headers, body} = response
  })
```

### `httpError(response)`

Takes a [Response](#response) and returns a future that produces an error if the HTTP status code is not between 200 and 299.

The resulting `HttpError` contains the original response as `error.response`.

```js
const {streamingRequest, httpError, HttpError} = require('xhttp/node')

streamingRequest(params)
  .mapResult(httpError)
  .map((error, response) => {
    if (error instanceof HttpError) {
      const {ok, status, statusText, headers, body} = error.response
    }
    else if (error) console.error(error)
    else console.info(response)
  })
```

### `isResponse(value)`

True if `value` looks like a [Response](#response).

```js
const {streamingRequest, isResponse} = require('xhttp/node')

streamingRequest(params).mapResult(response => {
  console.info(isResponse(response))
})
```

## Futures

All async functions in `xhttp` return Posterus futures. See the [Posterus documentation](https://github.com/Mitranim/posterus). They look and behave like promises:

```js
xhttp.streamingRequest({})
  .then(xhttp.httpError)
  .then(response => {})
  .catch(error => {})

async function main() {
  try {
    const response = xhttp.httpError(await xhttp.streamingRequest({}))
  }
  catch (err) {
    // ...
  }
}
```

As an added benefit, they support cancelation. To abort a request, call `.deinit()`:

```js
const future = xhttp.streamingRequest(params)
  .mapResult(xhttp.httpError)
  .map((error, response) => {
    // ...
  })

future.deinit()
```

Might want to consider [Posterus fibers](https://github.com/Mitranim/posterus#fiber). They're exactly like async functions, but support in-progress cancelation.

## Changelog

### 0.9 → 0.10.0

Minor but breaking cleanup in the Node.js version.

  * renamed `httpRequest` → `textRequest`
  * renamed `okErr` → `httpError`
  * `textRequest` and `jsonRequest` no longer implicitly use `httpError` to throw on non-200+ responses
  * an aborted response now has `.reason = 'abort'`, not `.reason = 'aborted'` for mental consistency with its counterpart in the browser library

Also updated dependencies.

### 0.8.0 → 0.9.0

Breaking: `Response` no longer has a `.stream` property; in a streaming response, the `.body` is a stream.

`bufferBody` and `stringifyBody` now work on anything with a `.body` and don't require the full `Response` structure.

`bufferBody` consistently returns a future.

Also see [readme.md#changelog](readme.md#changelog).

## Misc

No redirect support yet. Every time I _thought_ I needed redirects, after careful examination it turned out I didn't.

I'm receptive to suggestions. If this library _almost_ satisfies you but needs changes, open an issue or chat me up. Contacts: https://mitranim.com/#contacts
