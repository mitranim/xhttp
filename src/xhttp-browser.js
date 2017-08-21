/**
 * Shortcuts
 */

export function Xhttp (params, fun) {
  validate(isFunction, fun)
  return Xhr(params, function onXhrDone (event) {
    fun(eventToResponse(event))
  })
}

export function Xhr (params, fun) {
  validate(isFunction, fun)
  const xhr = new XMLHttpRequest()
  xhrInitParams(xhr, params)
  xhrSetMultiCallback(xhr, fun)
  xhrStart(xhr)
  return xhr
}

/**
 * Primary Utils
 */

export function xhrInitParams (xhr, params) {
  xhr.params = parseParams(params)
}

// WTB shorter name
export function xhrSetMultiCallback (xhr, fun) {
  validate(isFunction, fun)
  // Only one will ever be called.
  xhr.onabort = xhr.onerror = xhr.onload = xhr.ontimeout = fun
}

export function xhrOpen (xhr) {
  // In some circumstances Chrome may fail to report upload progress
  // unless you access `.upload` before opening the request.
  xhr.upload  // eslint-disable-line no-unused-expressions
  const {params: {method, url, async, username, password}} = xhr
  xhr.open(method, url, async, username, password)
  return xhr
}

export function xhrSendHeaders (xhr) {
  const {params: {headers: rawHeaders}} = xhr
  const headers = pickBy(meaningfulPair, rawHeaders)
  for (const key in headers) xhr.setRequestHeader(key, headers[key])
  return xhr
}

export function xhrSendBody (xhr) {
  const {params: {body}} = xhr
  xhr.send(body)
  return xhr
}

export function xhrStart (xhr) {
  if (xhr.readyState === xhr.UNSENT || xhr.readyState === xhr.DONE) {
    xhrOpen(xhr)
    xhrSendHeaders(xhr)
    xhrSendBody(xhr)
  }
  return xhr
}

export function xhrDestroy (xhr) {
  if (isObject(xhr) && isFunction(xhr.abort)) xhr.abort()
}

/**
 * Secondary Utils
 */

// TODO document
export function xhrGetDecodedResponseBody (xhr) {
  const type = xhr.getResponseHeader('content-type')

  return /application\/json/.test(type)
    ? JSON.parse(xhr.responseText)
    : /html/.test(type)
      ? new DOMParser().parseFromString(xhr.responseText, 'text/html')
      : /xml/.test(type)
        ? new DOMParser().parseFromString(xhr.responseText, 'text/xml')
        : xhr.responseText
}

// TODO document
export function parseParams (rawParams) {
  validate(isDict, rawParams)
  validate(isString, rawParams.url)
  if (rawParams.method) validate(isString, rawParams.method)

  const method = (rawParams.method || 'GET').toUpperCase()

  return merge(rawParams, {
    rawParams,
    method,
    async: rawParams.async !== false,
    url: encodeUrl(rawParams.url, method, rawParams.body),
    headers: isDict(rawParams.headers) ? rawParams.headers : {},
    body: encodeBody(rawParams.body, method, getContentTypeHeader(rawParams.headers)),
  })
}

export function eventToResponse (event) {
  // Get the timestamp before spending time on parsing
  const completedAt = Date.now()
  const {target: xhr, type: reason} = event
  const complete = xhr.readyState === xhr.DONE

  return {
    xhr,
    event,
    params: xhr.params,
    complete,
    completedAt,
    reason,
    status: xhr.status,
    ok: complete ? isStatusOk(xhr.status) : undefined,
    headers: headersToDict(xhr.getAllResponseHeaders()),
    body: xhrGetDecodedResponseBody(xhr),
  }
}

function isReadOnly (method) {
  return /get|head|options/i.test(method)
}

function encodeUrl (url, method, body) {
  return isReadOnly(method) && isDict(body)
    ? appendQuery(url, body)
    : url
}

function getContentTypeHeader (headers) {
  for (const key in headers) {
    if (/content-type/i.test(key)) return headers[key]
  }
  return undefined
}

function encodeBody (body, method, contentType) {
  return isReadOnly(method)
    ? null
    : /application\/json/.test(contentType) && isJSONEncodable(body)
      ? JSON.stringify(body)
      : /application\/x-www-form-urlencoded/.test(contentType) && isDict(body)
        ? formdataEncode(body)
        : body
}

export function isJSONEncodable (value) {
  return isDict(value) || isArray(value)
}

export function isStatusOk (status) {
  return status >= 200 && status <= 299
}

function appendQuery (url, queryDict) {
  const search = formdataEncode(queryDict)
  return !search ? url : `${url}${/\?/.test(url) ? '&' : '?'}${search}`
}

function formdataEncode (rawDict) {
  const pairs = []
  const dict = pickBy(meaningfulPair, rawDict)
  for (const key in dict) {
    pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(dict[key])}`)
  }
  return pairs.join('&')
}

export function headersToDict (headersString) {
  const headerDict = {}

  splitLines(headersString)
    .map(splitHeader)
    .filter(Boolean)
    .forEach(([_header, key, value]) => {
      headerDict[key.toLowerCase()] = value
    })

  return headerDict
}

function splitLines (string) {
  return string.split(/$/m)
}

function splitHeader (headerString) {
  return headerString.match(/^\s*([^:]+)\s*:\s*(.+)\s*$/m)
}

function isObject (value) {
  return value !== null && typeof value === 'object'
}

function isDict (value) {
  return isObject(value) && isPlainPrototype(Object.getPrototypeOf(value))
}

function isPlainPrototype (value) {
  return value === null || value === Object.prototype
}

function isArray (value) {
  return value instanceof Array
}

function isString (value) {
  return typeof value === 'string'
}

function isFunction (value) {
  return typeof value === 'function'
}

function validate (test, value) {
  if (!test(value)) throw Error(`Expected ${value} to satisfy test ${test.name}`)
}

function merge (left, right) {
  const out = {}
  for (const key in left) out[key] = left[key]
  for (const key in right) out[key] = right[key]
  return out
}

function pickBy (fun, dict) {
  const out = {}
  for (const key in dict) {
    if (fun(dict[key], key)) out[key] = dict[key]
  }
  return out
}

function meaningfulPair (left, right) {
  return meaningful(left) && meaningful(right)
}

function meaningful (value) {
  return value != null && value !== ''
}
