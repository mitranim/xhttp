[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg?style=flat)](http://standardjs.com)

## Description

Functional wrapper around `XMLHttpRequest`. Assumes JSON. Treats non-`2**` codes
as errors. Doesn't force promises, easy to wrap for a promise-based API. Should
be compatible with IE9+.

## TOC

* [Installation](#installation)
* [API](#api)
  * [params](#params)
  * [success](#success)
  * [error](#error)
* [Promises](#promises)

## Installation

```bash
npm i --save xhttp
# or
npm i --save-dev xhttp
```

`xhttp` is published as a CommonJS-style module. It assumes you're using a
module-oriented build system such as Webpack or browserify.

```js
import {xhttp} from 'xhttp'
// or
const {xhttp} = require('xhttp')

xhttp(
  {url: '/api/some-resource'},
  (res, xhr) => {/* ... */},
  (err, xhr) => {/* ... */}
)
```

## API

```
xhttp(
  params :: Object,
  onSuccess :: Function,
  onError :: Function
)
```

### `params`

```
url :: String

  required

method :: String

  optional
  default = 'GET'

body :: Object

  optional
  when method is GET, HEAD or OPTIONS, body is converted
  into a query string and appended to the URL
  otherwise it's JSON-encoded

headers :: Object

  optional
  default = {
    'Content-Type': 'application/json',
    'Accept': 'application/json'
  }

async :: Boolean

  optional
  default = true

username :: String

  optional

password :: String

  optional
```

### Success

```js
xhttp(_, onSuccess, _)

function onSuccess (response, xhr) {/* ... */}
```

Success callback. Receives response (parsed from JSON) and XHR object.

### Error

```js
xhttp(_, _, onError)

function onError (response, xhr) {/* ... */}
```

Error callback. Receives response (parsed from JSON) and XHR object.

## Promises

To get a promise-based API, wrap `xhttp` with your own Promise variant:

```js
function ajax (params) {
  return new Promise((resolve, reject) => {
    xhttp(params, resolve, reject)
  })
}
```
