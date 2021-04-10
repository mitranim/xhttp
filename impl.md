# Implementation Notes

## Code Duplication

The browser and Node versions share a big chunk of utility code, which is currently copy-pasted because:

* `xhttp` is usable as a native JS module. Additional files mean additional requests. There might be other hidden costs, unmitigated by HTTP/2.

* Much of that code is internal. Using a shared module would bloat the available API surface, which is already large.

## Browser

The following API limitations are caused by Node:

* `req()` creates an `XMLHttpRequest` and immediately starts it. This is done for symmetry with Node, where `http.request` and `https.request` immediately start the created requests. In browsers, we provide `start()` as a lower-level API to circumvent this.

* `wait()` always converts the received event to a response. This is done for symmetry with Node, which doesn't provide anything resembing the DOM `ProgressEvent`. Always creating our own response objects allows for a consistent API.

* Currently we always parse response headers into a dict, which is often wasted. It would be easy to avoid by defining a getter that parses once and replaces itself with a normal property. But we'd need to benchmark first.

* `resToComplete` and `resToString` exist only for compatibility with Node, but must always be used by isomorphic code. Browser-only code can skip them.

* `resToComplete`, `resToString`, `resNormal` are async for consistency with Node.

## Node

We use custom URL parsing and formatting functions, instead of Node's `'url'` package, for consistency with browser code, where custom functions are unavoidable.

## HTTP Methods

HTTP methods are case-sensitive, and standard methods are all-uppercase. In practice, browsers and Node may automatically uppercase standard methods, leaving others as-is. `xhttp` doesn't convert case, as it would break any case-sensitive code.

Reference: https://tools.ietf.org/html/rfc7231#section-4

## Documentation

Some APIs are exposed but undocumented, in an attempt to balance flexibility and simplicity. A bloated API documentation is hard to read, and lower-level APIs might make sense only to someone familiar with the source.
