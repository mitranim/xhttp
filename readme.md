> NOTE: I consider this deprecated in favour of the upcoming `fetch` standard.
> See [github/fetch](https://github.com/github/fetch) (working implementation)
> and the [standards proposal](https://fetch.spec.whatwg.org).

## Description

`xhttp` is a lightweight ajax utility with pluggable ES6 promises, interceptors, and no mandatory dependencies. Think of it as `jQuery.ajax` without jQuery or `$http` without Angular. It's 12 KB minified with the optional `es6-promise` dependency.

This is written with CommonJS modules and is expected to be used in a browserify or webpack build system. There's also a pre-built file that exposes a global `window.xhttp`.

By default, this uses [`es6-promise`](https://github.com/jakearchibald/es6-promise), but you can supply a promise constructor of your own (see below). When using this style, `es6-promise` won't be included into your build.

Works in evergreen browsers and IE9-11. See the ToDo section.

## Installation

```bash
npm install --save xhttp
```

Or for the global build:

```bash
bower install --save xhttp
```

The bower version uses the pre-built file that exposes the global `window.xhttp`.

## Initialisation

To get the default version, which will use the `es6-promise` shim, just require it:

```javascript
var xhttp = require('xhttp')
```

If your target browsers support native Promises, or the `Promise`
constructor is provided by a polyfill or other transformation, you
can include the native version, instead:

```javascript
var xhttp = require('xhttp/native')
```

You can also make your own version. Require `xhttp/custom` and call it with a custom promise constructor:

```javascript
var xhttp = require('xhttp/custom')(require('q').Promise)
var xhttp = require('xhttp/custom')(require('bluebird'))
```

Any spec-compliant Promise implementation will do. This includes most popular promise libraries, so you don't have to worry about it.

In ES6 (native or with the [Babel](https://babeljs.io/)) you can use:
```javascript
import xhttp from 'xhttp/native';
```

## Usage

### Making a request

Format:

```javascript
xhttp({options}) → promise → result
```

Example:

```javascript
xhttp({
  url: 'my-backend-url',
  method: 'post'
})
// Success handler
.then(function (data) {
  // do stuff with data
})
// Failure handler
.catch(console.error.bind(console))
```

xhttp checks the response's Content-Type header and automatically converts json or form-encoded responses into JavaScript objects. Other responses are left as-is.

### Options reference

#### `options.method`

The HTTP verb to use. If omitted, defaults to `GET`.

#### `options.url`

The URL of the request.

#### `options.params`

Hash table of query parameters to append to the URL. Example:

```javascript
xhttp({
  url: 'http://my-backend-url',
  params: {
    'my-param': 'my-value',
    'other-param': 'other-value'
  }
})
// request goes to:
// http://my-backend-url?my-param=my-value&other-param=other-value
```

Params are automatically URI-encoded.

#### `options.data`

The body of your request. If it's not a string, xhttp attempts to automatically stringify it based on `options.headers['Content-Type']`. See `options.headers` for content type detection.

If the content type is json or form-encoded and the data is an object, it's automatically converted to a json-encoded or form-encoded string. Otherwise the data is sent as-is.

Set `options.processData` to `false` to disable automatic conversion. Relevant when sending objects with special ajax behaviour, like instances of `FormData` or `Blob`.

#### `options.headers`

A hash table of header names and values. xhttp includes them into the XMLHttpRequest.

If headers don't include a `Content-Type` field, xhttp sets it automatically:

1. Using `options.type`, if specified.
2. Guessing based on data:
  * data is an object → `application/json; charset=utf-8`
  * data is a string → `text/plain; charset=utf-8`

#### `options.type`

Shortcut to `options.headers['Content-Type']`. The available options are:

```javascript
'plain'      →  'text/plain; charset=utf-8'
'json'       →  'application/json; charset=utf-8'
'form'       →  'application/x-www-form-urlencoded; charset=utf-8'
```

Ignored if `options.contentType` is set to `false`.

#### `options.timeout`

Request timeout in milliseconds. The default is `10000`.

#### `options.username`

Username to send for authentication.

#### `options.password`

Password to send for authentication.

#### `options.withCredentials`

Determines whether to send cookies and auth headers in cross-domain requests. See the XMLHttpRequest [reference](https://developer.mozilla.org/en-US/docs/Web/API/XMLHttpRequest#Properties). The default is `false`.

#### `options.contentType`

Set to `false` to disable automatic detection of `options.headers['Content-Type']` and ignore `options.type`. Relevant when sending objects with special ajax behaviour, like `FormData` or `Blob`.

#### `options.processData`

Set to `false` to disable automatic conversion of request body based on `options.headers['Content-Type']`. Relevant when sending objects with special ajax behaviour, like `FormData` or `Blob`.

### Interceptors

`xhttp` has three groups of interceptors:

``` javascript
xhttp.requestInterceptors   -- applied to the options of each request

xhttp.responseInterceptors  -- applied to each success response

xhttp.errorInterceptors     -- applied to each failure response
```

Request interceptors are called with `(options)`, where `options` is the
configuration object passed by the user into the `xhttp()` call. Interceptors
are allowed to mutate it (for instance, add `options.headers` or set a new
`options.data` value). They can optionally return a new object to replace the
config.

Success and error interceptors are called with `(data, xhr)`, where `data` is
the parsed body of the server response, and `xhr` is the native XMLHttpRequest
object. When an interceptor returns a non-undefined value, it replaces the data.
This allows to use interceptors as transformers.

Interceptors are applied in the same order as you add them.

#### `xhttp.interceptRequest(interceptor)`

Adds a request interceptor function.

Example:

``` javascript
xhttp.interceptRequest(function (options) {
  options.headers['my-header'] = 'blah'
  return options  // optional; may be a new object
})
```

#### `xhttp.interceptResponse(interceptor)`

Adds a response interceptor.

Example:

``` javascript
xhttp.interceptResponse(function (data, xhr) {
  var msg = xhr.getResponseHeader('Easter-Egg')
  if (msg) {
    console.log('-- message from Santa:', msg)
  }
  // returning `undefined` → no change in data
  // returning any other value would replace data
})
```

#### `xhttp.interceptError(interceptor)`

Adds an error interceptor.

Example:

``` javascript
xhttp.interceptError(function (data, xhr) {
  console.error(data)
  alert('Debug your flops')
  // returning `undefined` → no change in data
  // returning any other value would replace data
})
```

## Uniqueness

Be aware that CommonJS doesn't guarantee modules to be unique. Depending on your dependency tree, it's possible for your modules to receive a different instance of xhttp than a third party library that depends on xhttp (e.g. [Datacore](https://github.com/Mitranim/datacore)). In this case, custom interceptors defined in your files won't affect ajax calls made by that library. One solution is to expose the xhttp object in each library that depends on it, and in the user scripts, check for xhttp object equality and apply the same set of interceptors to each instance.

## ToDo / WIP

* Support upload progress events
* Tests
* Check if we need to support responseXML
