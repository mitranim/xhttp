## Overview

`xhttp` is a pair of lightweight libraries for making HTTP requests in Node.js and browsers.

**This readme is for the Node library only.** For the browser version, see [readme.md](readme.md).

Not isomorphic: has different APIs for Node and browsers.

## Overview: Node Library

Toolkit for making HTTP requests in Node. Adds convenient shortcuts on top of the standard `http` module. **Much** more lightweight than other similar libraries.

## TOC

* [Why](#why)
* [Installation](#installation)
* [Usage](#usage)
* [API](#api)
  * [`Signatures`](#signatures)
  * [`streamingRequest`](#streamingrequestparams-done)
  * [`bufferedRequest`](#bufferedrequestparams-done)
  * [`textRequest`](#textrequestparams-done)
  * [`jsonRequest`](#jsonrequestparams-done)
  * [`bufferStream`](#bufferstreamstream-done)
  * [`isResponse`](#isresponsevalue)
* [Promises](#promises)
* [Changelog](#changelog)
* [Misc](#misc)

## Why

* Convenient:

  * nice high level API
  * compresses request/response lifecycles and events into a single callback
  * retains access to Node APIs
  * usable response metadata

* Lightweight: <300 LoC, one small [dependency](https://github.com/Mitranim/fpx)

* Efficient: few layers of crap

### Why not `request`

(`request` is a popular HTTP library for Node.) It has a baroque API that requires another wrapper just to make it usable. It fails to provide response metadata in a usable format (see [Signatures](#signatures)). Despite that, it manages to have so many dependencies that it takes 100 ms to start up on my machine. Very unhealthy.

## Installation

Shell:

```sh
npm i -E xhttp
# or
yarn add -E xhttp
```

Node:

```js
const xhttp = require('xhttp/node')
```

For Node, you must import from **`xhttp/node`**, not `xhttp`.

## Usage

Basic request, with streamed response body:

```js
const xhttp = require('xhttp/node')

const req = xhttp.streamingRequest({url: '<some url>'}, (err, response) => {
  const {ok, status, statusText, headers, body} = response
  // body is a stream and hasn't been fully downloaded yet
  body.pipe(process.stdout)
})

// `req` is a Node `ClientRequest`
```

Other functions pre-buffer the response:

```js
xhttp.bufferedRequest({url: '<some url>'}, (err, response) => {
  const {body} = response
  // body is a Buffer
})

xhttp.textRequest({url: '<some url>'}, (err, response) => {
  const {body} = response
  // body is a string
})

xhttp.jsonRequest({url: '<some url>'}, (err, response) => {
  const {body} = response
  // body is parsed from JSON, if possible
})
```

Send a stream, a byte buffer, or a string:

```js
xhttp.textRequest({
  url: '...',
  method: 'post',
  body: fs.createReadStream('some-file'),
}, ...)

xhttp.textRequest({
  url: '...',
  method: 'post',
  body: Buffer.from('hello world!'),
}, ...)

xhttp.textRequest({
  url: '...',
  method: 'post',
  body: 'hello world!',
}, ...)
```

Request-making functions return a Node [`ClientRequest`](https://nodejs.org/api/http.html#http_class_http_clientrequest). Use it for cancelation:

```js
const req = xhttp.textRequest(params, done)
req.abort()
```

## API

### Signatures

All request-making functions have the following signature:

```
ƒ(Params, Callback) -> ClientRequest
```

The user callback has the following signature:

```
f(Error, Response)
```

Request params must look like this:

```ts
interface Params {
  url: string
  method: ?string
  headers: ?{[string]: string}
  timeout: ?number
  body: ?Stream|Buffer|string
}
```

The response provided to the callback looks like this:

```ts
interface Response {
  // True if status is between 200 and 299
  ok: boolean
  status: string
  statusText: string
  // One of: 'load' | 'timeout' | 'abort' | 'aborted'
  reason: string
  // Response headers, with lowercased keys
  headers: {[string]: string}
  body: ?(ReadableStream|Buffer|string)
  params: Params
}
```

For `ClientRequest`, see Node's [documentation](https://nodejs.org/api/http.html#http_class_http_clientrequest).

### `streamingRequest(params, done)`

Lowest-level API in this library.

Makes a request, calling `done(err, response)` as soon as it receives the response headers. `response.body` is a [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) that's still being downloaded.

See [Signatures](#signatures) for the params and response structure.

```js
xhttp.streamingRequest({url: '<some url>'}, (err, response) => {
  const {ok, status, statusText, headers, body} = response
  body.pipe(process.stdout)
})
```

Cancelation:

```js
const req = xhttp.streamingRequest(params, done)
req.abort()
```

### `bufferedRequest(params, done)`

Makes a request, calling `done(err, response)` after fully downloading `response.body` as a Node `Buffer` (raw bytes). See [Signatures](#signatures) for the params and response structure.

```js
xhttp.bufferedRequest({url: '<some url>'}, (err, response) => {
  const {ok, status, statusText, headers, body} = response
})
```

### `textRequest(params, done)`

Makes a request, calling `done(err, response)` after fully downloading `response.body` as a string. See [Signatures](#signatures) for the params and response structure.

```js
xhttp.textRequest({url: '<some url>'}, (err, response) => {
  const {ok, status, statusText, headers, body} = response
})
```

### `jsonRequest(params, done)`

Makes a request, encoding `params.body` as JSON and adding the appropriate request headers.

Fully buffers the response body and attempts to decode it as JSON if the _response headers_ (not the request headers) have the `application/json` content type. Calls `done(err, response)` when finished.

See [Signatures](#signatures) for the params and response structure.

```js
xhttp.jsonRequest({
  url: '<some url>',
  body: {key: 'value'},
}, (err, response) => {
  // If the response content type is JSON, body is decoded
  const {body} = response
})
```

### `bufferStream(stream, done)`

Takes a Node [readable stream](https://nodejs.org/api/stream.html#stream_class_stream_readable) and fully drains it, calling `done(err, body)` when finished. The `body` will be either a string or a `Buffer` depending on the stream contents. Used internally in [`bufferedStream`](#bufferedrequestparams-done). Exported as a general-purpose utility.

```js
const fs = require('fs')
const xhttp = require('xhttp')

xhttp.bufferStream(fs.createReadStream(__filename), (err, body) => {
  console.info(String(body))
})
```

### `isResponse(value)`

True if `value` looks like a valid Response. See [Signatures](#signatures).

```js
xhttp.streamingRequest(params, (err, response) => {
  console.info(xhttp.isResponse(response))
})
```

## Promises

The API is entirely callback-based because there are multiple competing approaches to promises/futures/observables/etc. To support your particular variant, use a simple wrapper like this:

```js
function textRequest(params) {
  let req
  const out = new Promise((resolve, reject) => {
    req = xhttp.textRequest(params, (err, response) => {
      if (err) reject(err)
      else resolve(response)
    })
  })
  // Keep request available for cancelation
  // This demonstrates the fatal deficiency of promises
  out.req = req
  return out
}
```

## Changelog

### 0.11.0

Breaking: removed futures and the Posterus dependency. The API is now callback-based. The user is expected to add promises/futures/observables/etc. by themselves. This makes us more flexible and lightweight.

### 0.10.0

Minor but breaking cleanup.

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
