'use strict'

const http = require('http')
const https = require('https')
const {parse: parseUrl} = require('url')
const {Future} = require('posterus')
const {isPrimitive, isDict, isFunction, isObject, isString, isBoolean, isFinite, validate} = require('fpx')

/**
 * Public
 */

exports.httpRequest = httpRequest
function httpRequest(params) {
  return bufferedRequest(params).mapResult(stringifyBody).mapResult(okErr)
}

exports.jsonRequest = jsonRequest
function jsonRequest(params) {
  return bufferedRequest(toJsonParams(params))
    .mapResult(stringifyBody)
    .mapResult(maybeParseBody)
    .mapResult(okErr)
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

  return Future.init(function initHttpRequest(future) {
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
      req.abort()
      throw err
    }

    return req.abort.bind(req)
  })
}

exports.parseParams = parseParams
function parseParams(params) {
  validate(isDict, params)
  const {protocol, hostname, port, path, hash, auth} = parseUrl(params.url)
  return patch({protocol, hostname, port, path: `${path}${hash || ''}`, auth}, params, {url: null})
}

exports.bufferBody = bufferBody
function bufferBody(response) {
  validate(isResponse, response)
  return response.stream
    ? bufferStream(response.stream)
      .mapResult(function bufferedResponse(body) {
        return patch(response, {stream: null, body})
      })
    : response.body == null
    ? patch(response, {body: Buffer.alloc(0)})
    : Future.fromResult(response)
}

exports.stringifyBody = stringifyBody
function stringifyBody(response) {
  validate(isResponse, response)
  validate(isBufferOrString, response.body)
  return patch(response, {body: String(response.body)})
}

exports.maybeParseBody = maybeParseBody
function maybeParseBody(response) {
  const {headers: {'content-type': contentType}, body} = response
  return /application[/]json/.test(contentType)
    ? patch(response, {body: JSON.parse(body)})
    : response
}

exports.isResponse = isResponse
function isResponse(value) {
  return isObject(value) &&
    isBoolean(value.ok) &&
    isFinite(value.status) &&
    isDict(value.headers)
}

exports.okErr = okErr
function okErr(response) {
  validate(isResponse, response)
  if (response.ok) return response
  throw new HttpError(response)
}

exports.bufferStream = bufferStream
function bufferStream(stream) {
  validate(isReadableStream, stream)
  return Future.init(initStreamBuffering.bind(null, stream))
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
    validate(isResponse, response)
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
    stream: res,
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
    reason: 'aborted',
    headers: {},
    params,
    body: Buffer.alloc(0),
  }
}

function initStreamBuffering(stream, future) {
  validate(isReadableStream, stream)

  const chunks = []

  stream.on('data', onData)
  stream.once('error', onErr)
  stream.once('end', onEnd)

  function deinit() {
    stream.removeListener('data', onData)
    stream.removeListener('error', onErr)
    stream.removeListener('end', onEnd)
  }

  function onData(chunk) {
    validate(isBufferOrString, chunk)
    chunks.push(chunk)
  }

  function onErr(err) {
    deinit()
    future.settle(err)
  }

  function onEnd() {
    deinit()
    const [error, result] = tryCatch(concatChunks, chunks)
    future.settle(error, result)
  }

  return deinitStream.bind(null, stream)
}

function isBufferOrString(value) {
  return Buffer.isBuffer(value) || isString(value)
}

function concatChunks(chunks) {
  return chunks.some(isString) ? chunks.join('') : Buffer.concat(chunks)
}

function sendBody(req, body) {
  if (isReadableStream(body)) body.pipe(req)
  else req.end(body)
}

function isReadableStream(value) {
  return isStream(value) && isFunction(value.read)
}

function _isWritableStream(value) {
  return isStream(value) && isFunction(value.write)
}

function isStream(value) {
  return isEmitter(value) && isFunction(value.pipe)
}

function isEmitter(value) {
  return isObject(value) &&
    isFunction(value.on) &&
    isFunction(value.once) &&
    isFunction(value.removeListener)
}

function deinitStream(stream) {
  if (isFunction(stream.destroy)) stream.destroy()
  else stream.end()
}

function tryCatch(fun, arg) {
  try {return [undefined, fun(arg)]}
  catch (err) {return [err, undefined]}
}

function patch(...values) {
  const out = {}
  for (const value of values) {
    if (isPrimitive(value)) continue
    for (const key in value) {
      if (value[key] == null) delete out[key]
      else out[key] = value[key]
    }
  }
  return out
}
