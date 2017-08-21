## Overview

`xhttp` is a pair of lightweight libraries for making HTTP requests in Node.js
and browsers.

**This readme is for the browser library only.** For the Node.js version, see
[readme-node.md](readme-node.md).

Not isomorphic, at least not yet. Has different APIs for Node and browser.

## Overview: Browser Library

Toolkit for `XMLHttpRequest`, the browser API for making HTTP requests. Makes it
practical and convenient to use.

Difference from other similar libraries:
  * keeps the `XMLHttpRequest` object accessible
  * no premature branching: one callback with one argument
  * doesn't force promises (easy to add)

Small (≈250 LOC) and has no dependencies. Compatible with IE9+.

## TOC

* [Why](#why)
* [Installation](#installation)
* [API](#api)
  * [`Xhttp`](#xhttpparams-fun)
  * [`Xhr`](#xhrparams-fun)
  * [Params](#params)
  * [Response](#response)
  * [Encoding and Parsing](#encoding-and-parsing)
* [API (Secondary)](#api-secondary)
  * [`xhrInitParams`](#xhrinitparamsxhr-params)
  * [`xhrSetMultiCallback`](#xhrsetmulticallbackxhr-fun)
  * [`xhrOpen`](#xhropenxhr)
  * [`xhrSendHeaders`](#xhrsendheadersxhr)
  * [`xhrSendBody`](#xhrsendbodyxhr)
  * [`xhrStart`](#xhrstartxhr)
  * [`xhrDestroy`](#xhrdestroyxhr)
  * [`eventToResponse`](#eventtoresponseevent)
* [Promises](#promises)

## Why

### Why bother?

Most HTTP libraries make the same mistakes `jQuery.ajax` did:

  * losing access to the `XMLHttpRequest`
  * premature branching into multiple callbacks
  * one huge over-configurable function instead of a toolkit
  * multiple arguments instead of one result

JavaScript forces callbacks for asynchonous actions. This alone is bad enough.
_Multiple_ callbacks for one action borders on masochism. It causes people to
invent "finally"-style callbacks just to hack around the fact they have branched
prematurely. `xhttp` lets you have a single callback (see
[`Xhttp`](#xhttpparams-fun)). One continuation is better than many; it's never
too late to branch!

Other libraries spread request results over multiple arguments (body, xhr etc.).
`xhttp` bundles it all into a single value (see [Response](#response)), which is
convenient for further API adaptations. Adding a [Promise-based](#promises) or
[future-based](https://github.com/Mitranim/posterus) API becomes trivial.

Many libraries make another big mistake: losing a reference to the underlying
`XMLHttpRequest` object, hiding it behind callbacks or a promise. `xhttp` keeps
you in control by never hiding the xhr object.

### Why not `fetch`?

(`fetch` is a recently standardised alternative to `XMLHttpRequest`.)

`fetch` is fundamentally broken because it gives you a promise instead of a
reference to the HTTP task, hiding a rich, manageable reference behind ephemeral
callbacks. As a result, it lacks such vital features as:

  * upload progress
  * ability to abort

It has only one real advantage over `XMLHttpRequest`: streaming the response
instead of buffering it all in memory, but this is irrelevant for most uses, and
will probably get bolted on `XMLHttpRequest` some day.

## Installation

```bash
npm install --exact xhttp
```

Requires a module bundler such as Webpack or Rollup. Available in ES2015 and
CommonJS formats.

```js
import {Xhttp} from 'xhttp'
```

## API

### `Xhttp(params, fun)`

Highest-level API in this library. Takes configuration [params](#params) and
a callback, starts the request, and returns the `XMLHttpRequest` object.

Builds on [`Xhr`](#xhrparams-fun) and other utils.

```js
const xhr = Xhttp({url: '/'}, ({ok, status, reason, headers, body}) => {
  if (ok) console.info('Success:', body)
  else console.warn('Failure:', body)
})
```

When the request ends _for any reason_, the callback is called with one
argument: the [Response](#response) created with
[`eventToResponse`](#eventtoresponseevent).

Note: there's no "success" or "failure" callbacks. You can branch based on the
HTTP `status`, the `reason` the request was stopped, or the shorthand `ok` which
means `reason === 'load'` and `status` between 200 and 299.

#### `xhr.params`

Parsed version of the [params](#params) passed to the constructor.

### `Xhr(params, fun)`

Basis for [`Xhttp`](#xhttpparams-fun). Takes [params](#params) and a callback,
starts the request, and returns the `XMLHttpRequest` object. Assigns the parsed
params as `xhr.params`.

`fun` is attached via [`xhrSetMultiCallback`](#xhrsetmulticallbackxhr-fun). No
other activity is scheduled, and it's up to `fun` to parse the response
(default: [`eventToResponse`](#eventtoresponseevent)).

Useful when you need precise control over parsing the response.

Custom parsing:

```js
const {Xhr} = require('xhttp')

function MyXhr (params, fun) {
  return Xhr(params, function onXhrDone (event) {
    fun(myResponseParser(event))
  })
}

MyXhr({url: '/'}, response => {console.info(response)})
```

### Params

The configuration dict passed to [`Xhttp`](#xhttpparams-fun) must have the
following structure.

```ts
type Params {
  // Required
  // For GET and HEAD, body may be appended to url
  // See Encoding and Parsing
  url: string,

  method: ?string,

  // May be automatically encoded depending on method and headers
  // See Encoding and Parsing
  body: any,

  headers: ?{[string]: string},

  // Don't touch this
  async: ?boolean,
  username: ?string,
  password: ?string,
}
```

### Response

This value is formed when the request ends and is passed to the `Xhr` callback.

```ts
type Response {
  // True if `reason === 'load'` and `status` is between 200 and 299
  ok: boolean,
  status: number,
  statusText: string,

  // Response headers; keys are lowercase
  headers: ?{[string]: string},

  // Response body, possibly decoded; see Encoding and Parsing
  body: any,

  // The DOM event passed to the event listener that fired when the request
  // ended. There are four possible event types. The event type is duplicated
  // as `reason`, see below.
  event: Event,

  // Type of the DOM event that fired when the request was stopped
  // One of:
  //   'abort'    -- request was aborted
  //   'error'    -- network error (dns lookup, loss of connection, etc.)
  //   'load'     -- request finished successfully
  //   'timeout'  -- request timed out
  reason: string,

  // Parsed request params
  params: Params,

  // Unix timestamp in milliseconds
  completedAt: number,

  xhr: XMLHttpRequest,
}
```

### Encoding and Parsing

`xhttp` automatically encodes and decodes some common formats, depending on
method, request headers, and response headers.

If the method is read-only (GET, HEAD or OPTIONS) and the body is a plain dict,
it's automatically formdata-encoded and appended to the URL as "search" after
`?`.

If the method is _not_ read-only:

  * If the headers specify the JSON content type (`application/json`) and the
    body is a plain dict or list, it's automatically JSON-encoded. Primitives
    and special objects are passed unchanged.

  * If the headers specify the formdata content type
    (`application/x-www-form-urlencoded`) and the body is a plain dict, it's
    automatically formdata-encoded.

If the _response_ headers specify a content type known to `xhttp`, such as JSON,
`html` or `xml`, it's automatically parsed into the corresponding data
structure. Otherwise it's returned as a string.

Pay attention to your headers. You may want to write a tiny wrapper to add
default headers to all your requests.

## API (Secondary)

Internal utils used to implement [`Xhttp`](#xhttpparams-fun) and
[`Xhr`](#xhrparams-fun). Convenient if you want to assemble a slightly different
version:

```js
const {xhrInitParams, xhrOpen, xhrSendHeaders, xhrSendBody} = require('xhttp')

function MyXhr (params) {
  const xhr = new XMLHttpRequest()
  // ... custom code here?
  xhrInitParams(xhr, params)
  // ... custom code here?
  xhrSetMultiCallback(xhr, finalCallback)
  // ... custom code here?
  xhrOpen(xhr)
  // ... custom code here?
  xhrSendHeaders(xhr)
  // ... custom code here?
  xhrSendBody(xhr)
  // ... custom code here?
  return xhr
}
```

### `xhrInitParams(xhr, params)`

Parses `params`, ensuring they're well-formed, and assigns them to `xhr` as
`xhr.params`. The resulting params are used in other utils, and included as
part of the eventual response.

### `xhrSetMultiCallback(xhr, fun)`

Attaches `fun` to all four "final" methods of the xhr object: `onabort`,
`onerror`, `onload`, `ontimeout`. One and only one of them will eventually be
called when the request is done. `fun` will receive an event telling it what
happened.

`fun` is attached as-is, without automatic response parsing or forming a
`Response`. This is useful if you have your own ideas what to do with the
response.

### `xhrStart(xhr)`

Combines `xhrOpen`, `xhrSendHeaders`, `xhrSendBody`. See below.
[`Xhr`](#xhrparams-fun) calls this automatically.

### `xhrOpen(xhr)`

Must be called after `xhrInitParams`. Opens the request using the `xhr.params`.

### `xhrSendHeaders(xhr)`

Must be called after `xhrOpen`. Sends the headers, previously included as part
of `xhr.params`.

### `xhrSendBody(xhr)`

Must be called after `xhrSendHeaders`. Sends the body, previously encoded as
part of `xhr.params`.

### `xhrDestroy(xhr)`

Aborts the request if `xhr` is an `XMLHttpRequest` object. Has no effect
otherwise. Safe to use on non-xhr values such as `null`. Returns `undefined`.

### `eventToResponse(event)`

Takes an event passed to any `XMLHttpRequest` event listener and parses it into
a [Response](#response). Used inside [`Xhr`](#xhrparams-fun). Use it when assembling
your own custom version of [`Xhr`](#xhrparams-fun).

```js
xhrSetMultiCallback(xhr, function onXhrDone (event) {
  xhr.response = eventToResponse(event)
})
```

## Promises

Write your own adapter for a promise API:

```js
const {Xhttp} = require('xhttp')

function XhrP (params) {
  let resolve
  const wait = new Promise(x => {resolve = x})
  const xhr = Xhttp(params, resolve)
  xhr.wait = wait
  return xhr
}

XhrP({url: '/'}).wait.then(response => {
  // ...
})
```

Branch into `then/catch` if you want:

```js
const {Xhttp} = require('xhttp')

function XhrP (params) {
  let resolve
  let reject

  const wait = new Promise((a, b) => {
    resolve = a
    reject = b
  })

  const xhr = Xhttp(params, response => {
    (response.ok ? resolve : reject)(response)
  })

  xhr.wait = wait
  return xhr
}

XhrP({url: '/'}).wait
  .then(response => {/* ... */})
  .catch(response => {/* ... */})
```
