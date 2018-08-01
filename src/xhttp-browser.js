/**
 * Public
 */

export function Xhttp(params, fun) {
  validate(params, isDict)
  validate(fun, isFunction)

  params = transformParams(params)
  const xhr = new XMLHttpRequest()

  start(xhr, params, function onXhrDone(event) {
    const response = eventToResponse(event)
    response.body = getResponseBody(xhr)
    response.params = params
    fun(response)
  })

  return xhr
}

export function transformParams(params) {
  validate(params, isDict)
  validate(params.url, isString)
  if (params.method) validate(params.method, isString)
  const method = (params.method || 'GET').toUpperCase()

  return patch(params, {
    rawParams: params,
    method,
    url: encodeUrl(params.url, method, params.body),
    headers: isDict(params.headers) ? params.headers : {},
    body: encodeBody(params.body, method, findContentType(params.headers)),
  })
}

export function start(xhr, params, fun) {
  validate(params, isDict)
  validate(fun, isFunction)

  if (!(xhr.readyState === xhr.UNSENT || xhr.readyState === xhr.DONE)) {
    throw Error(`Request can be started only when UNSENT or DONE`)
  }

  setCallback(xhr, fun)
  open(xhr, params)
  sendHeaders(xhr, params)
  sendBody(xhr, params)
}

export function setCallback(xhr, fun) {
  validate(fun, isFunction)
  // Only one will be called
  xhr.onabort = xhr.onerror = xhr.onload = xhr.ontimeout = fun
}

export function open(xhr, {method, url, username, password}) {
  // In some circumstances Chrome may fail to report upload progress
  // unless you access `.upload` before opening the request.
  xhr.upload  // eslint-disable-line no-unused-expressions
  xhr.open(method, url, true, username, password)
}

export function sendHeaders(xhr, {headers}) {
  if (headers) {
    for (const key in headers) {
      const value = headers[key]
      if (key && value) xhr.setRequestHeader(key, value)
    }
  }
}

export function sendBody(xhr, {body}) {
  xhr.send(body)
}

export function abort(xhr) {
  if (isObject(xhr) && isFunction(xhr.abort)) {
    xhr.abort()
  }
}

export function abortSilently(xhr) {
  if (isObject(xhr) && isFunction(xhr.abort)) {
    if (xhr.onabort) xhr.onabort = null
    xhr.abort()
  }
}

export function eventToResponse(event) {
  // Get current time before spending time on other actions
  const completedAt = Date.now()
  const {target: xhr, type: reason} = event
  const complete = xhr.readyState === xhr.DONE

  return {
    xhr,
    event,
    complete,
    completedAt,
    reason,
    status: xhr.status,
    statusText: xhr.statusText,
    ok: complete ? isStatusOk(xhr.status) : undefined,
    headers: headerLinesToDict(xhr.getAllResponseHeaders()),
  }
}

export function getResponseBody(xhr) {
  const type = xhr.getResponseHeader('content-type')
  return /application\/json/.test(type)
    ? JSON.parse(xhr.responseText)
    : xhr.responseText
}

/**
 * Internal
 */

function isReadOnly(method) {
  return !method || /GET|HEAD|OPTIONS/i.test(method)
}

function encodeUrl(url, method, body) {
  return isReadOnly(method) && isDict(body)
    ? appendQuery(url, body)
    : url
}

function findContentType(headers) {
  for (const key in headers) {
    if (/content-type/i.test(key)) return headers[key]
  }
  return undefined
}

function encodeBody(body, method, contentType) {
  return isReadOnly(method)
    ? undefined
    : /application\/json/i.test(contentType) && isJSONEncodable(body)
    ? JSON.stringify(body)
    : /application\/x-www-form-urlencoded/i.test(contentType) && isDict(body)
    ? formdataEncode(body)
    : body
}

export function isJSONEncodable(value) {
  return isDict(value) || isArray(value)
}

export function isStatusOk(status) {
  return status >= 200 && status <= 299
}

function appendQuery(url, queryDict) {
  const search = formdataEncode(queryDict)
  return !search
    ? url
    : /\?/.test(url)
    ? `${url}&${search}`
    : `${url}?${search}`
}

export function formdataEncode(dict) {
  const pairs = []
  if (isDict(dict)) {
    for (const key in dict) {
      const value = dict[key]
      if (key && value != null && value !== '') {
        pairs.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
      }
    }
  }
  return pairs.join('&')
}

export function headerLinesToDict(headerLines) {
  const out = {}
  const lines = headerLines.split(/$/m)
  for (let i = -1; ++i < lines.length;) {
    const match = lines[i].match(/^\s*([^:]+)\s*:\s*(.+)\s*$/m)
    if (!match) continue
    const key = match[1].toLowerCase()
    const value = match[2]
    // Overrides repeating headers instead of grouping them.
    // Unsure which behavior is more practical.
    out[key] = value
  }
  return out
}

function isObject(value) {
  return value !== null && typeof value === 'object'
}

function isDict(value) {
  return isObject(value) && isPlainPrototype(Object.getPrototypeOf(value))
}

function isPlainPrototype(value) {
  return value === null || value === Object.prototype
}

function isArray(value) {
  return value instanceof Array
}

function isString(value) {
  return typeof value === 'string'
}

function isFunction(value) {
  return typeof value === 'function'
}

function validate(value, test) {
  if (!test(value)) throw Error(`Expected ${value} to satisfy test ${test.name}`)
}

function patch(left, right) {
  const out = {}
  if (left) for (const key in left) out[key] = left[key]
  if (right) for (const key in right) out[key] = right[key]
  return out
}
