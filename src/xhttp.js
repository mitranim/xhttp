/**
 * TODO
 *   shorter function names
 */

/**
 * Shortcuts
 */

export function Xhr (params, onDone) {
  const xhr = new XMLHttpRequest()
  xhrInitParams(xhr, params)

  xhrSetMultiCallback(xhr, function xhrDone (event) {
    xhr.result = eventToResult(event)
    if (isFunction(onDone)) onDone(xhr.result)
  })

  xhr.start = xhrStart.bind(null, xhr)

  return xhr
}

/**
 * Primary Utils
 */

export function xhrInitParams (xhr, params) {
  xhr.params = parseParams(params)
}

export function xhrSetMultiCallback (xhr, fun) {
  validate(isFunction, fun)
  xhr.onabort = xhr.onerror = xhr.onload = xhr.ontimeout = fun
}

export function xhrStart (xhr) {
  xhrOpen(xhr)
  xhrSendHeaders(xhr)
  xhrSendBody(xhr)
  return xhr
}

export function xhrOpen (xhr) {
  // In some circumstances Chrome may fail to report upload progress. Accessing
  // `.upload` before opening the request magically solves the problem.
  xhr.upload
  const {params: {method, url, async, username, password}} = xhr
  xhr.open(method, url, async, username, password)
  return xhr
}

export function xhrSendHeaders (xhr) {
  const {params: {headers: rawHeaders}} = xhr
  const headers = pickBy(meaningfulPair, rawHeaders)
  for (const key in headers) {
    xhr.setRequestHeader(key, headers[key])
  }
  return xhr
}

export function xhrSendBody (xhr) {
  const {params: {body}} = xhr
  xhr.send(body)
  return xhr
}

export function xhrDestroy (xhr) {
  if (isDict(xhr) && isFunction(xhr.abort)) xhr.abort()
}

/**
 * Secondary Utils
 */

export function parseParams (rawParams) {
  validate(isDict, rawParams)
  validate(isString, rawParams.url)
  if (rawParams.method) validate(isString, rawParams.method)

  const method = (rawParams.method || 'GET').toUpperCase()

  return merge(rawParams, {
    rawParams,
    method,
    async: rawParams.async === false ? false : true,
    url: encodeUrl(rawParams.url, method, rawParams.body),
    headers: isDict(rawParams.headers) ? rawParams.headers : {},
    body: encodeBody(rawParams.body, method, getContentTypeHeader(rawParams.headers)),
  })
}

export function eventToResult (event) {
  const {target: xhr, type: reason} = event
  const complete = xhr.readyState === xhr.DONE
  return {
    xhr,
    event,
    params: xhr.params,
    complete,
    reason,
    status: xhr.status,
    ok: complete ? isStatusOk(xhr.status) : undefined,
    headers: headersToDict(xhr.getAllResponseHeaders()),
    body: xhrGetDecodedResponseBody(xhr),
  }
}

export function xhrGetDecodedResponseBody (xhr) {
  const type = xhr.getResponseHeader('content-type')

  return /json/.test(type)
    ? jsonDecode(xhr.responseText)
    : /html/.test(type)
    ? new DOMParser().parseFromString(xhr.responseText, 'text/html')
    : /xml/.test(type)
    ? new DOMParser().parseFromString(xhr.responseText, 'text/xml')
    : xhr.responseText
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
}

function encodeBody (body, method, contentType) {
  return isReadOnly(method)
    ? null
    : /application\/json/.test(contentType) && isJSONEncodable(body)
    ? jsonEncode(body)
    : /application\/x-www-form-urlencoded/.test(contentType) && isDict(body)
    ? formdataEncode(body)
    : body
}

// Problem:
//   JSON.stringify(null)       = 'null'
//   JSON.stringify(undefined)  = undefined
function jsonEncode (value) {
  try {return JSON.stringify(value)}
  catch (_) {return 'null'}
}

// Problem:
//   JSON.parse('')                = exception!
//   JSON.parse(JSON.stringify())  = exception!
function jsonDecode (value) {
  try {return JSON.parse(value)}
  catch (_) {return null}
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
    pairs.push(encodeURIComponent(key) + '=' + encodeURIComponent(dict[key]))
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
