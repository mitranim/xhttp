'use strict'

const http = require('http')
const https = require('https')
const {parse: parseUrl} = require('url')
const f = require('fpx')

/** Public **/

exports.jsonRequest = jsonRequest
function jsonRequest(params, done) {
  f.validate(done, f.isFunction)

  return textRequest(toJsonParams(params), function onResponse(error, response) {
    try {
      if (response) response = maybeParseBody(response)
    }
    catch (err) {
      error = err
    }
    done(error, response)
  })
}

exports.textRequest = textRequest
function textRequest(params, done) {
  f.validate(done, f.isFunction)
  return bufferedRequest(params, function onResponse(error, response) {
    if (error) {
      done(error)
      return
    }
    const {body} = response
    done(undefined, {...response, body: body && String(body)})
  })
}

exports.bufferedRequest = bufferedRequest
function bufferedRequest(params, done) {
  f.validate(done, f.isFunction)

  return streamingRequest(params, function onResponse(error, response) {
    if (error) {
      done(error)
      return
    }

    if (!isReadableStream(response.body)) {
      done(undefined, response)
      return
    }

    bufferStream(response.body, function onBuffered(error, body) {
      if (error) done(error)
      else done(undefined, {...response, body})
    })
  })
}

exports.streamingRequest = streamingRequest
function streamingRequest(params, done) {
  f.validate(done, f.isFunction)

  params = parseParams(params)
  const {request} = params.protocol === 'https:' ? https : http
  const req = request(params)

  if (params.timeout) req.setTimeout(params.timeout)

  req.once('response', function onResponse(res) {
    done(undefined, streamingResponse(params, res))
  })

  req.once('error', function onRequestError(err) {
    req.abort()
    done(err)
  })

  req.once('timeout', function onRequestTimeout() {
    done(new HttpError(timeoutResponse(params)))
  })

  req.once('abort', function onRequestAbortedByClient() {
    done(new HttpError(clientAbortResponse(params)))
  })

  req.once('aborted', function onRequestAbortedByRemote() {
    done(new HttpError(remoteAbortResponse(params)))
  })

  sendBody(req, params.body)

  return req
}

exports.parseParams = parseParams
function parseParams(params) {
  f.validate(params, f.isObject)

  const {url, body} = params
  if (body != null) f.validate(body, isReadableStreamOrStringOrBuffer)

  f.validate(url, f.isString)
  const {protocol, hostname, port, path, hash, auth} = parseUrl(params.url)

  return {
    protocol,
    hostname,
    port,
    path: `${path}${hash || ''}`,
    auth,
    ...params,
    url: undefined,
  }
}

exports.maybeParseBody = maybeParseBody
function maybeParseBody(response) {
  let {headers, body} = response
  // Note: Node.js lowercases response headers
  const contentType = headers['content-type']
  if (/application[/]json/.test(contentType) && body) {
    return {...response, body: JSON.parse(body)}
  }
  return response
}

exports.isResponse = isResponse
function isResponse(value) {
  return f.isObject(value) &&
    f.isBoolean(value.ok) &&
    f.isNatural(value.status) &&
    f.isObject(value.headers)
}

exports.bufferStream = bufferStream
function bufferStream(stream, done) {
  f.validate(stream, isReadableStream)
  f.validate(done, f.isFunction)

  const chunks = []

  function onData(chunk) {
    chunks.push(chunk)
  }

  function onError(err) {
    finalize()
    done(err)
  }

  function onEnd() {
    finalize()
    done(undefined, concatChunks(chunks))
  }

  stream.on('data', onData)
  stream.once('error', done)
  stream.once('end', onEnd)

  function finalize(error) {
    stream.removeListener('data', onData)
    stream.removeListener('error', onError)
    stream.removeListener('end', onEnd)
    if (error) deinitStream(stream)
  }
}

const jsonHeaders = exports.jsonHeaders = {
  'content-type': 'application/json',
  accept: 'application/json',
}

exports.toJsonParams = toJsonParams
function toJsonParams(params) {
  const {headers, body} = params
  return {
    ...params,
    headers: {...jsonHeaders, ...headers},
    body: body == null ? undefined : JSON.stringify(body),
  }
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

/** Utils **/

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
    body: undefined,
  }
}

function clientAbortResponse(params) {
  return {
    ok: false,
    status: 0,
    statusText: 'Aborted by Client',
    reason: 'abort',
    headers: {},
    params,
    body: undefined,
  }
}

function remoteAbortResponse(params) {
  return {
    ...clientAbortResponse(params),
    statusText: 'Aborted by Remote',
    reason: 'aborted',
  }
}

function concatChunks(chunks) {
  if (chunks.every(f.isString)) return chunks.join('')
  if (chunks.every(Buffer.isBuffer)) return Buffer.concat(chunks)
  return Buffer.concat(chunks.map(toBuffer))
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
