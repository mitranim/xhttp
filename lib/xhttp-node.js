'use strict'

const http = require('http')
const https = require('https')
const {parse: parseUrl} = require('url')
const {Future} = require('posterus')
const f = require('fpx')

/**
 * Public
 */

exports.jsonRequest = jsonRequest
function jsonRequest(params) {
  return textRequest(toJsonParams(params)).mapResult(maybeParseBody)
}

exports.textRequest = textRequest
function textRequest(params) {
  return bufferedRequest(params).mapResult(stringifyBody)
}

exports.bufferedRequest = bufferedRequest
function bufferedRequest(params) {
  return streamingRequest(params).mapResult(bufferBody)
}

exports.streamingRequest = streamingRequest
function streamingRequest() {
  const params = parseParams(...arguments)
  const {request} = params.protocol === 'https:' ? https : http
  const req = request(params)

  if (params.timeout) req.setTimeout(params.timeout)

  const future = new Future()

  req.once('response', function onResponse(res) {
    future.settle(null, streamingResponse(params, res))
  })

  req.once('error', function onRequestError(err) {
    req.abort()
    future.settle(err)
  })

  req.once('timeout', function onRequestTimeout() {
    future.settle(null, timeoutResponse(params))
  })

  req.once('aborted', function onRequestAbortedByRemote() {
    future.settle(abortedResponse(params))
  })

  try {
    sendBody(req, params.body)
  }
  catch (err) {
    future.settle(err)
  }

  return future.finally(function finalizeRequest(error) {
    if (error) req.abort()
  })
}

exports.parseParams = parseParams
function parseParams(params) {
  f.validate(params, f.isObject)

  const {url, body} = params
  if (body != null) f.validate(body, isReadableStreamOrStringOrBuffer)

  f.validate(url, f.isString)
  const {protocol, hostname, port, path, hash, auth} = parseUrl(params.url)

  return patch(
    {protocol, hostname, port, path: `${path}${hash || ''}`, auth},
    params,
    {url: null}
  )
}

exports.bufferBody = bufferBody
function bufferBody(value) {
  f.validate(value, f.isObject)
  return Buffer.isBuffer(value.body)
    ? Future.fromResult(value)
    : isReadableStream(value.body)
    ? bufferStream(value.body).mapResult(body => patch(value, {body}))
    : value.body == null
    ? Future.fromResult(patch(value, {body: Buffer.alloc(0)}))
    : Future.fromResult(patch(value, {body: Buffer.from(value.body)}))
}

exports.stringifyBody = stringifyBody
function stringifyBody(value) {
  f.validate(value, f.isObject)
  f.validate(value.body, isBufferOrString)
  return patch(value, {body: String(value.body)})
}

exports.maybeParseBody = maybeParseBody
function maybeParseBody(response) {
  // Headers have been lowercased by Node.js
  const {headers: {'content-type': contentType}, body} = response
  return /application[/]json/.test(contentType)
    ? patch(response, {body: JSON.parse(body)})
    : response
}

exports.isResponse = isResponse
function isResponse(value) {
  return f.isObject(value) &&
    f.isBoolean(value.ok) &&
    f.isNatural(value.status) &&
    f.isObject(value.headers)
}

exports.httpError = httpError
function httpError(response) {
  f.validate(response, isResponse)
  if (response.ok) return response
  throw new HttpError(response)
}

exports.bufferStream = bufferStream
function bufferStream(stream) {
  f.validate(stream, isReadableStream)

  const future = new Future()
  const chunks = []

  function onData(chunk) {
    try {
      f.validate(chunk, isBufferOrString)
      chunks.push(chunk)
    }
    catch (err) {
      future.settle(err)
    }
  }

  const settle = future.settle.bind(future)

  function onEnd() {
    try {
      future.settle(undefined, concatChunks(chunks))
    }
    catch (err) {
      future.settle(err)
    }
  }

  stream.on('data', onData)
  stream.once('error', settle)
  stream.once('end', onEnd)

  return future.finally(function finalizeStream(error) {
    stream.removeListener('data', onData)
    stream.removeListener('error', settle)
    stream.removeListener('end', onEnd)
    if (error) deinitStream(stream)
  })
}

const jsonHeaders = exports.jsonHeaders = {
  'content-type': 'application/json',
  accept: 'application/json',
}

exports.toJsonParams = toJsonParams
function toJsonParams(params) {
  const {headers, body} = params
  return patch(params, {
    headers: patch(jsonHeaders, headers),
    body: body == null ? null : JSON.stringify(body),
  })
}

class HttpError extends Error {
  constructor(response) {
    f.validate(response, isResponse)
    super(response.statusText)
    this.response = response
  }
  get name() {return this.constructor.name}
}
exports.HttpError = HttpError

/**
 * Utils
 */

function streamingResponse(params, res) {
  const {statusCode: status, statusMessage: statusText, headers} = res
  return {
    ok: status >= 200 && status <= 299,
    status,
    statusText,
    reason: 'load',
    headers,
    body: res,
    params,
  }
}

function timeoutResponse(params) {
  return {
    ok: false,
    status: 408,
    statusText: 'Request Timeout',
    reason: 'timeout',
    headers: {},
    params,
    body: Buffer.alloc(0),
  }
}

function abortedResponse(params) {
  return {
    ok: false,
    status: 0,
    statusText: 'Aborted by Remote',
    reason: 'abort',
    headers: {},
    params,
    body: Buffer.alloc(0),
  }
}

function isBufferOrString(value) {
  return Buffer.isBuffer(value) || f.isString(value)
}

function concatChunks(chunks) {
  return chunks.every(f.isString)
    ? chunks.join('')
    : chunks.every(Buffer.isBuffer)
    ? Buffer.concat(chunks)
    : Buffer.concat(chunks.map(toBuffer))
}

function toBuffer(value) {
  return Buffer.isBuffer(value) ? value : Buffer.from(value)
}

function sendBody(req, body) {
  if (isReadableStream(body)) body.pipe(req)
  else req.end(body)
}

function isReadableStream(value) {
  return isStream(value) && f.isFunction(value.read)
}

function _isWritableStream(value) {
  return isStream(value) && f.isFunction(value.write)
}

function isStream(value) {
  return isEmitter(value) && f.isFunction(value.pipe)
}

function isEmitter(value) {
  return f.isObject(value) &&
    f.isFunction(value.on) &&
    f.isFunction(value.once) &&
    f.isFunction(value.removeListener)
}

function isReadableStreamOrStringOrBuffer(value) {
  return isReadableStream(value) || f.isString(value) || Buffer.isBuffer(value)
}

function deinitStream(value) {
  if (!f.isObject(value)) return
  if (f.isFunction(value.destroy)) value.destroy()
  else if (f.isFunction(value.end)) value.end()
}

function patch() {
  const out = Object.assign({}, ...arguments)
  for (const key in out) if (out[key] == null) delete out[key]
  return out
}
