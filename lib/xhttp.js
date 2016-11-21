export function xhttp (params, onSuccess, onError) {
  validate(isPlainObject, params)
  validate(isString, params.url)
  validate(isFunction, onSuccess)
  validate(isFunction, onError)

  const method = (params.method || 'GET').toUpperCase()
  const url = readOnly(method) ? encodeUrl(params.url, params.body) : params.url

  const xhr = new XMLHttpRequest()

  xhr.open(
    method,
    url,
    isBoolean(params.async) ? params.async : true,
    params.username || '',
    params.password || ''
  )

  const headers = addHeaders(params.headers, params.body)
  for (const key in headers) xhr.setRequestHeader(key, headers[key])

  xhr.onerror = xhr.ontimeout = decodeAndRun(onError)
  xhr.onload = statusSwitch(decodeAndRun(onSuccess), xhr.onerror)
  xhr.send(readOnly(method) ? null : encodePermissive(params.body))

  return xhr
}

/**
 * Utils
 */

const jsonHeaders = {
  'Content-Type': 'application/json',
  Accept: 'application/json',
}

function addHeaders (headers, body) {
  return isSerialisable(body)
    ? concat(jsonHeaders, headers)
    : headers || {}
}

function concat (left, right) {
  const buffer = {}
  if (isPlainObject(left)) for (const key in left) buffer[key] = left[key]
  if (isPlainObject(right)) for (const key in right) buffer[key] = right[key]
  return buffer
}

function encodeUrl (url, body) {
  return isPlainObject(body) ? joinWithQuery(url, encodeQuery(body)) : url
}

function encodeQuery (value) {
  const buffer = []
  for (const key in value) {
    buffer.push(`${encodeURIComponent(key)}=${encodeURIComponent(value[key])}`)
  }
  return buffer.join('&')
}

function joinWithQuery (url, query) {
  return query ? `${url}?${query}` : url
}

function readOnly (method) {
  return method === 'GET' || method === 'HEAD' || method === 'OPTIONS'
}

function isObject (value) {
  return value !== null && typeof value === 'object'
}

function isPlainObject (value) {
  return isObject(value) && (value.constructor === Object || !('constructor' in value))
}

function isArray (value) {
  return value instanceof Array
}

function isBoolean (value) {
  return typeof value === 'boolean'
}

function isString (value) {
  return typeof value === 'string'
}

function isFunction (value) {
  return typeof value === 'function'
}

function isSerialisable (value) {
  return !isObject(value) || isArray(value) || isPlainObject(value) || 'toJSON' in value
}

function encodePermissive (value) {
  return isSerialisable(value) ? JSON.stringify(value) : value
}

function decodePermissive (value) {
  try {return JSON.parse(value)} catch (_) {return value}  // eslint-disable-line
}

function statusSwitch (ok, fail) {
  return function statusSwitch () {
    return (this.status > 199 && this.status < 300 ? ok : fail).call(this)
  }
}

function decodeAndRun (func) {
  return function decodeAndRun () {
    return func.call(this, decodePermissive(this.responseText), this)
  }
}

function validate (test, value) {
  if (!test(value)) throw Error(`Expected ${value} to satisfy test ${test.name}`)
}
