'use strict'

/* global XMLHttpRequest */

export function xhttp (params, onSuccess, onError) {
  validate(params, isPlainObject)
  validate(params.url, isString)
  validate(onSuccess, isFunction)
  validate(onError, isFunction)

  const xhr = new XMLHttpRequest()
  const method = (params.method || 'GET').toUpperCase()
  const url = encodeUrl(method, params.url, params.body)

  xhr.open(
    method,
    url,
    isBoolean(params.async) ? params.async : true,
    params.username || '',
    params.password || ''
  )

  const headers = contentHeaders(params.headers, params.body)
  for (const key in headers) {
    xhr.setRequestHeader(key, headers[key])
  }

  xhr.onerror = xhr.ontimeout = xhr.onabort = onload(onError)
  xhr.onload = statusSwitch(onload(onSuccess), xhr.onerror)
  xhr.send(serialiseBody(method, params.body))
}

/**
 * Utils
 */

function merge (left, right) {
  const buffer = {}
  if (isPlainObject(left)) for (const key in left) buffer[key] = left[key]
  if (isPlainObject(right)) for (const key in right) buffer[key] = right[key]
  return buffer
}

function serialiseBody (method, body) {
  return readOnly(method)
    ? null
    : isSerialisable(body)
    ? JSON.stringify(body)
    : body
}

const jsonHeaders = {
  'Content-Type': 'application/json',
  'Accept': 'application/json'
}

function contentHeaders (headers, body) {
  return isSerialisable(body)
    ? merge(jsonHeaders, headers)
    : isPlainObject(headers)
    ? headers
    : {}
}

function encodeUrl (method, url, body) {
  return readOnly(method) && isPlainObject(body)
    ? joinWithQuery(url, encodeQuery(body))
    : url
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

function isSerialisable (value) {
  return !isObject(value) || isArray(value) || isPlainObject(value) || 'toJSON' in value
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

function parsePermissive (value) {
  try {return JSON.parse(value)} catch (_) {return value}  // eslint-disable-line
}

function statusSwitch (ok, fail) {
  return function statusSwitch () {
    return this.status > 199 && this.status < 300
      ? ok.call(this)
      : fail.call(this)
  }
}

function onload (func) {
  return function onload () {
    return func(parsePermissive(this.responseText), this)
  }
}

function validate (value, test) {
  if (!test(value)) throw Error(`Expected ${value} to satisfy test ${test.name}`)
}
