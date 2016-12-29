## Description

Toolkit for `XMLHttpRequest`, the browser API for making HTTP requests. Makes it
practical and convenient to use.

Difference from other similar libraries:
  * does **not** abstract away the underlying `XMLHttpRequest` object
  * no premature branching: one callback and one result
  * doesn't force promises (easy to add)

Small (≈250 LOC) and has no dependencies. Compatible with IE9+.

## TOC

* [Why](#why)
* [Installation](#installation)
* [API](#api)
  * [`Xhr`](#xhrparams-ondone)
  * [Params](#params)
  * [Result](#result)
  * [Encoding and Parsing](#encoding-and-parsing)
* [API (Secondary)](#api-secondary)
  * [`xhrInitParams`](#xhrinitparamsxhr-params)
  * [`xhrSetMultiCallback`](#xhrsetmulticallbackxhr-fun)
  * [`xhrStart`](#xhrstartxhr)
  * [`xhrOpen`](#xhropenxhr)
  * [`xhrSendHeaders`](#xhrsendheadersxhr)
  * [`xhrSendBody`](#xhrsendbodyxhr)
  * [`xhrDestroy`](#xhrdestroyxhr)
* [Promises](#promises)

## Why

### Why bother?

Most HTTP libraries make the same mistakes `jQuery.ajax` did:

  * premature branching into multiple callbacks
  * one huge over-configurable function instead of a toolkit
  * multiple arguments instead of one result

JavaScript forces callbacks for asynchonous actions. This alone is bad enough.
_Multiple_ callbacks for one action borders on masochism. It causes people to
invent "finally"-style callbacks just to hack around the fact they have branched
prematurely. `xhttp` uses a single callback. One continuation is better than
many; it's never too late to branch!

Other libraries spread request results over multiple arguments (body, xhr etc.).
`xhttp` bundles it all into a single value (see [Result](#result)), which is
convenient for further API adaptations. Adding a [Promise-based](#promises) or
generator-based API becomes trivial.

Many libraries make another big mistake: losing a reference to the underlying
`XMLHttpRequest` object, masking it behind callbacks or a promise. `xhttp` keeps
you in control by never masking the xhr object.

Finally, `xhttp` respects your laziness. It prepares an xhr object, adding a
single, convenient method that starts the request. But it lets _you_ "pull the
trigger". Convenient for building advanced network utilities with queueing,
deduplication etc.

### Why not `fetch`?

(`fetch` is a recently standardised alternative to `XMLHttpRequest`.)

`fetch` is fundamentally broken because it gives you a promise instead of a
reference to the HTTP task, masking a rich, manageable reference behind
ephemeral callbacks. As a result, it lacks such vital features as:

  * upload progress
  * ability to abort

It has only one real advantage over `XMLHttpRequest`: streaming the response
instead of buffering it all in memory, but this is irrelevant for most uses, and
will probably get bolted on `XMLHttpRequest` some day.

## Installation

```bash
npm i --save xhttp
# or
npm i --save-dev xhttp
```

This is a CommonJS-style package. It assumes you're using a package-oriented
build system such as Webpack or browserify.

```js
import {Xhr} from 'xhttp'
// or
const {Xhr} = require('xhttp')
```

## API

### `Xhr(params, onDone)`

The primary API of this library. Takes configuration [params](#params) and
returns a fully prepared `XMLHttpRequest` object. The returned instance has one
extra method: `xhr.start()`. Call it to actually start the request.

When the request stops, it calls the provided `onDone` function, passing the
final [result](#result), which contains all relevant information.

Note: there's no "success" or "failure" callbacks. You can branch based on the
HTTP `status`, the `reason` the request was stopped, or the shorthand `ok` which
means `reason === 'load'` and `status` between 200 and 299.

```js
const xhr = Xhr({url: '/'}, ({ok, status, reason, headers, body}) => {
  if (ok) console.info('Success:', body)
  else console.warn('Failure:', body)
}).start()
```

**Note**: the request is inert until you call `.start()`. You can delay
requests, batch them together, or even abandon before starting. This is up to
you.

### Params

The configuration dict passed to `Xhr` must have the following structure.

```ml
url :: String

  required

  `body` may be encoded into `url`, see Encoding and Parsing

method :: String

  optional

  default = "GET"

body :: Object

  optional

  may be automatically encoded, see Encoding and Parsing

headers :: Object

  optional

async :: Boolean

  optional
  default = true

username :: String

  optional

password :: String

  optional
```

### Result

This is what the value passed to the `Xhr` callback looks like.

```ml
xhr :: XMLHttpRequest

  self-explanatory

event :: Event

  corresponds to the type of the event listener (1 of 4)
  that fired when the request was stopped; see `reason` below

params :: Params

  see the Params section

complete :: Boolean

  true if the request has finished, aborted, or errored out

  false if the request is still in progress
  (will never happen with Xhr)

completedAt :: Number

  Unix timestamp of the moment the request had finished

reason :: String

  corresponds to the type of the event listener (1 of 4)
  that fired when the request was stopped

  one of:
    "abort"    -- request was aborted
    "error"    -- network error (dns lookup, loss of connection, etc.)
    "load"     -- request finished successfully
    "timeout"  -- request timed out

status :: Number

  http status copied from xhr object

ok :: Boolean

  true if `reason` is "load" and `status` is between 200 and 299
  false otherwise

headers :: Dict String String

  dictionary of response headers
  all keys are lowercase

body :: Any

  response text

  may be automatically decoded, see Encoding and Parsing
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

Internal utils used to implement `Xhr`. Convenient if you want to assemble a
slightly different version:

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
part of the eventual result.

### `xhrSetMultiCallback(xhr, fun)`

Attaches `fun` to all four "final" methods of the xhr object: `onabort`,
`onerror`, `onload`, `ontimeout`. One and only one of them will eventually be
called when the request is done. `fun` will receive an event telling it what
happened.

`fun` is attached as-is, without automatic response parsing or forming a
`Result`. This is useful if you have your own ideas what to do with the
response.

### `xhrStart(xhr)`

Combines `xhrOpen`, `xhrSendHeaders`, `xhrSendBody`. See below.

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

## Promises

To get a promise-based API, write your own adapter:

```js
const {Xhr} = require('xhttp')

function XhrP (params) {
  let resolve
  const wait = new Promise(x => {resolve = x})
  const xhr = Xhr(params, resolve)
  xhr.wait = wait
  return xhr
}

XhrP({url: '/'}).wait.then(result => {
  // ...
})
```

You can branch into `then/catch` if you want:

```js
const {Xhr} = require('xhttp')

function XhrP (params) {
  let resolve
  let reject

  const wait = new Promise((a, b) => {
    resolve = a
    reject = b
  })

  const xhr = Xhr(params, result => {
    (result.ok ? resolve : reject)(result)
  })

  xhr.wait = wait
  return xhr
}

XhrP({url: '/'}).wait
  .then(result => {/* ... */})
  .catch(result => {/* ... */})
```
