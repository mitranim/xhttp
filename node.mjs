// Node implementation. For browsers, use `./xhttp.mjs`.
// See implementation notes in `impl.md`.

import * as http from 'http'
import * as https from 'https'

export function req(params) {
  validate(params, isParams)

  const {url, query, body, ...rest} = params
  const request = isUrlHttps(url) ? https.request : http.request
  const req = request(urlWithQuery(url, query), normalizeParams(rest))

  req.params = params

  if (isReadableStream(body)) body.pipe(req)
  else req.end(body)

  return req
}

export function wait(req) {
  validate(req, isReq)

  return new Promise(function initWait(done, fail) {
    req.once('response', function onNodeRes(val) {
      done(streamRes(req, val))
    })

    req.once('error', function onNodeReqError(err) {
      req.abort()
      fail(err)
    })

    req.once('timeout', function onNodeReqTimeout() {
      done(timeoutRes(req))
    })

    req.once('abort', function onNodeReqAbortedByClient() {
      done(clientAbortRes(req))
    })

    req.once('aborted', function onNodeReqAbortedByRemote() {
      done(remoteAbortRes(req))
    })
  })
}

export function resNormal(res) {
  return resToString(resOnlyOk(res))
}

export function resOnlyComplete(res) {
  validate(res, isRes)
  if (!res.complete) throw new ResErr(res)
  return res
}

export function resOnlyOk(res) {
  validate(res, isRes)
  if (!res.ok) throw new ResErr(res)
  return res
}

// Node-only API. Converts the response body from a stream to either `Buffer` or
// a string, depending on the stream's contents. (In practice, the output is a
// `Buffer`.)
export async function resToComplete(res) {
  validate(res, isRes)

  const {body, ...rest} = res
  if (body == null) return res

  validate(body, isReadableStream)
  return {...rest, complete: true, body: await bufferStream(body)}
}

export async function resToString(res) {
  const {body, ...rest} = await resToComplete(res)
  return {...rest, body: (body && String(body)) || ''}
}

export function resFromJson(res) {
  validate(res, isRes)
  const {body, ...rest} = res
  return {...rest, bodyText: body, body: maybeJsonParse(body)}
}

export function paramsToJson(params) {
  validate(params, isParams)
  const {head, body, ...rest} = params
  return {
    ...rest,
    head: {...onlyDict(head), 'content-type': 'application/json'},
    body: JSON.stringify(body),
  }
}

export function urlWithQuery(url, query) {
  validate(url, isString)
  const search = queryFormat(query)
  return !search
    ? url
    : urlJoin(urlBase(url), searchJoin(urlSearch(url), search), urlHash(url))
}

export function queryFormat(query) {
  query = onlyDict(query)
  let out = ''
  for (const key in query) {
    out = searchJoin(out, queryFormatPair(key, query[key]))
  }
  return out
}

function searchJoin(left, right) {
  return left && right ? `${left}&${right}` : left || right
}

export function urlJoin(base, search, hash) {
  search = onlyString(search)
  hash = onlyString(hash)
  return `${onlyString(base)}${search && `?${search}`}${hash && `#${hash}`}`
}

export function urlBase(url) {
  url = urlWithoutHash(onlyString(url))
  const ind = url.indexOf('?')
  return ind >= 0 ? url.slice(0, ind) : url
}

export function urlSearch(url) {
  url = urlWithoutHash(onlyString(url))
  const ind = url.indexOf('?')
  return ind >= 0 ? url.slice(ind + 1) : ''
}

export function urlHash(url) {
  url = onlyString(url)
  const ind = url.indexOf('#')
  return ind >= 0 ? url.slice(ind + 1) : ''
}

export function isStatusOk(status) {
  return isNumber(status) && status >= 200 && status <= 299
}

export class ResErr extends Error {
  constructor(res) {
    validate(res, isRes)

    const {status, statusText, body} = res
    const stat = status || statusText

    super(`HTTP error${stat ? ` ${stat}` : ``}${isString(body) ? `: ${preview(body)}` : ``}`)

    this.status = status
    this.statusText = statusText
    this.res = res
  }
}

/* Internal Utils */

function isReq(val) {
  return isInstance(val, http.ClientRequest)
}

function isRes(val) {
  return isDict(val) && isString(val.type) && isBoolean(val.ok) && isNumber(val.status)
}

function isParams(val) {
  return isDict(val) && isString(val.url)
}

function isInstance(val, Cls) {
  return isObject(val) && val instanceof Cls
}

function isString(val) {
  return typeof val === 'string'
}

function isBoolean(val) {
  return typeof val === 'boolean'
}

function isNumber(val) {
  return typeof val === 'number'
}

function isObject(val) {
  return val !== null && typeof val === 'object'
}

function isDict(val) {
  if (!isObject(val)) return false
  const proto = Object.getPrototypeOf(val)
  return proto === null || proto === Object.prototype
}

function isArray(val) {
  return isInstance(val, Array)
}

function isFunction(val) {
  return typeof val === 'function'
}

function isDate(val) {
  return isInstance(val, Date)
}

function isComplex(val) {
  return isObject(val) || isFunction(val)
}

function isPrimitive(val) {
  return !isComplex(val)
}

function validate(val, test) {
  if (!test(val)) throw Error(`expected ${show(val)} to satisfy test ${show(test)}`)
}

function show(val) {
  if (isFunction(val) && val.name) return val.name
  if (isArray(val) || isDict(val) || isString(val)) return JSON.stringify(val)
  return `${val}`
}

function onlyDict(val) {
  if (val == null) return {}
  validate(val, isDict)
  return val
}

function onlyString(val) {
  if (val == null) return ''
  validate(val, isString)
  return val
}

function queryFormatPair(key, val) {
  validate(key, isString)
  if (!key) return ''

  if (isArray(val)) {
    let out = ''
    for (const elem of val) out = searchJoin(out, queryFormatPair(key, elem))
    return out
  }

  return `${key}=${queryFormatVal(val)}`
}

function queryFormatVal(val) {
  if (val == null) return ''
  if (isDate(val)) return val.toISOString()
  validate(val, isPrimitive)
  return `${val}`
}

function urlWithoutHash(url) {
  const ind = url.indexOf('#')
  return ind >= 0 ? url.slice(0, ind) : url
}

function maybeJsonParse(val) {
  return isString(val) ? (val ? JSON.parse(val) : null) : val
}

function preview(str) {
  validate(str, isString)
  const limit = 128
  return str.length > limit ? `${str.slice(0, limit)} ...` : str
}

function isUrlHttps(url) {
  return url.startsWith('https://')
}

function normalizeParams({username, password, head, ...rest}) {
  return {
    auth: maybeAuth(username, password),
    headers: onlyDict(head),
    ...rest,
  }
}

function maybeAuth(user, pass) {
  if (user || pass) {
    validate(user, isString)
    validate(pass, isString)
    return `${user}:${pass}`
  }
  return undefined
}

function streamRes(req, nodeRes) {
  const {statusCode: status, statusMessage: statusText, headers: head} = nodeRes
  return {
    req,
    type: 'load',
    ok: isStatusOk(status),
    complete: false,
    status,
    statusText,
    head: onlyDict(head),
    body: nodeRes,
    params: req.params,
  }
}

function timeoutRes(req) {
  return {
    req,
    type: 'timeout',
    ok: false,
    complete: false,
    status: 408,
    statusText: 'request timeout',
    head: {},
    body: '',
    params: req.params,
  }
}

function clientAbortRes(req) {
  return {
    req,
    type: 'abort',
    ok: false,
    complete: false,
    status: 0,
    statusText: 'aborted by client',
    head: {},
    body: '',
    params: req.params,
  }
}

function remoteAbortRes(req) {
  return {
    ...clientAbortRes(req),
    type: 'aborted',
    statusText: 'aborted by remote',
  }
}

// Node-only API. Returns a promise that resolves to the stream's accumulated
// bulk. Caution: the resulting value can be either `Buffer` or a string,
// depending on the stream contents.
export function bufferStream(stream) {
  validate(stream, isReadableStream)
  const chunks = []

  return new Promise(function initStreamToBuffer(done, fail) {
    function onData(chunk) {
      chunks.push(chunk)
    }

    function onError(err) {
      clear()
      deinitStream(stream)
      fail(err)
    }

    function onEnd() {
      clear()
      try {
        done(concatChunks(chunks))
      }
      catch (err) {
        fail(err)
      }
    }

    function clear() {
      stream.removeListener('data', onData)
      stream.removeListener('error', onError)
      stream.removeListener('end', onEnd)
    }

    stream.on('data', onData)
    stream.once('error', onError)
    stream.once('end', onEnd)
  })
}

function concatChunks(chunks) {
  if (chunks.every(isString)) return chunks.join('')
  if (chunks.every(Buffer.isBuffer)) return Buffer.concat(chunks)
  return Buffer.concat(chunks.map(toBuffer))
}

function toBuffer(val) {
  return Buffer.isBuffer(val) ? val : Buffer.from(val)
}

function deinitStream(val) {
  if (!isObject(val)) return
  if (isFunction(val.destroy)) val.destroy()
  else if (isFunction(val.end)) val.end()
}

function isReadableStream(val) {
  return isStream(val) && isFunction(val.read)
}

function isStream(val) {
  return isEmitter(val) && isFunction(val.pipe)
}

function isEmitter(val) {
  return isObject(val) &&
    isFunction(val.on) &&
    isFunction(val.once) &&
    isFunction(val.removeListener)
}
