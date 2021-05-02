// Node implementation. For browsers, use `./xhttp.mjs`.
// See implementation notes in `impl.md`.

import * as http from 'http'
import * as https from 'https'

export function req(params) {
  valid(params, isParams)

  const {url, query, body, ...rest} = params
  const request = isUrlHttps(url) ? https.request : http.request
  const req = request(urlWithQuery(url, query), normalizeParams(rest))

  req.params = params

  if (isReadableStream(body)) body.pipe(req)
  else req.end(body)

  return req
}

export function wait(req) {
  valid(req, isReq)

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
  valid(res, isRes)
  if (!res.complete) throw new ResErr(res)
  return res
}

export function resOnlyOk(res) {
  valid(res, isRes)
  if (!res.ok) throw new ResErr(res)
  return res
}

// Node-only API. Converts the response body from a stream to either `Buffer` or
// a string, depending on the stream's contents.
//
// The non-stream body comes from our own fake responses such as `timeoutRes`.
export async function resToComplete(res) {
  valid(res, isRes)

  const {body, ...rest} = res
  if (body == null || isStr(body) || Buffer.isBuffer(body)) return res

  valid(body, isReadableStream)
  return {...rest, complete: true, body: await bufferStream(body)}
}

export async function resToString(res) {
  const {body, ...rest} = await resToComplete(res)
  return {...rest, body: (body && String(body)) || ''}
}

export function resFromJson(res) {
  valid(res, isRes)
  const {body, ...rest} = res
  return {...rest, bodyText: body, body: maybeJsonParse(body)}
}

export function paramsToJson(params) {
  valid(params, isParams)
  const {headers, body, ...rest} = params
  return {
    ...rest,
    headers: {...dict(headers), 'content-type': 'application/json'},
    body: JSON.stringify(body),
  }
}

export function urlWithQuery(url, query) {
  url = new URL(url)
  searchAssign(url.searchParams, query)
  return url
}

export function isStatusOk(status) {
  return isNum(status) && status >= 200 && status <= 299
}

export class ResErr extends Error {
  constructor(res) {
    valid(res, isRes)

    const {status, statusText, type, body} = res
    const stat = status || statusText
    const msg = (isStr(body) && preview(body)) || type || 'unknown'
    super(`HTTP error${stat ? ` ${stat}` : ``}: ${msg}`)

    this.status = status
    this.statusText = statusText
    this.res = res
  }
}

/* Internal Utils */

function isReq(val)       {return isInst(val, http.ClientRequest)}
function isRes(val)       {return isDict(val) && isStr(val.type) && isBool(val.ok) && isNum(val.status)}
function isParams(val)    {return isDict(val) && isUrl(val.url)}
function isNil(val)       {return val == null}
function isStr(val)       {return typeof val === 'string'}
function isBool(val)      {return typeof val === 'boolean'}
function isNum(val)       {return typeof val === 'number'}
function isObj(val)       {return val !== null && typeof val === 'object'}
function isArr(val)       {return isInst(val, Array)}
function isFun(val)       {return typeof val === 'function'}
function isDate(val)      {return isInst(val, Date)}
function isComp(val)      {return isObj(val) || isFun(val)}
function isPrim(val)      {return !isComp(val)}
function isUrl(val)       {return isStr(val) || isInst(val, URL)}
function isInst(val, Cls) {return isObj(val) && val instanceof Cls}

function isDict(val) {
  if (!isObj(val)) return false
  const proto = Object.getPrototypeOf(val)
  return proto === null || proto === Object.prototype
}

function dict(val)       {return isNil(val) ? {} : only(val, isDict)}
function only(val, test) {valid(val, test); return val}

function valid(val, test) {
  if (!test(val)) throw Error(`expected ${show(val)} to satisfy test ${show(test)}`)
}

function show(val) {
  if (isFun(val) && val.name) return val.name
  if (isArr(val) || isDict(val) || isStr(val)) return JSON.stringify(val)
  return String(val)
}

function maybeJsonParse(val) {
  return isStr(val) ? (val ? JSON.parse(val) : null) : val
}

function preview(str) {
  valid(str, isStr)
  const limit = 128
  return str.length > limit ? `${str.slice(0, limit)} ...` : str
}

function isUrlHttps(url) {
  if (isStr(url)) return url.startsWith('https://')
  return url.protocol === 'https:'
}

function normalizeParams({username, password, headers, ...rest}) {
  return {
    auth: maybeAuth(username, password),
    headers: dict(headers),
    ...rest,
  }
}

function maybeAuth(user, pass) {
  if (user || pass) {
    valid(user, isStr)
    valid(pass, isStr)
    return `${user}:${pass}`
  }
  return undefined
}

function streamRes(req, nodeRes) {
  const {statusCode: status, statusMessage: statusText, headers} = nodeRes
  return {
    req,
    type: 'load',
    ok: isStatusOk(status),
    complete: false,
    status,
    statusText,
    headers: dict(headers),
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
    headers: {},
    body: 'request timeout',
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
    headers: {},
    body: 'request aborted by client',
    params: req.params,
  }
}

function remoteAbortRes(req) {
  return {
    ...clientAbortRes(req),
    type: 'aborted',
    statusText: 'aborted by remote',
    body: 'request aborted by remote',
  }
}

// Node-only API. Returns a promise that resolves to the stream's accumulated
// bulk. Caution: the resulting value can be either `Buffer` or a string,
// depending on the stream contents.
export function bufferStream(stream) {
  valid(stream, isReadableStream)
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
  if (chunks.every(isStr)) return chunks.join('')
  if (chunks.every(Buffer.isBuffer)) return Buffer.concat(chunks)
  return Buffer.concat(chunks.map(toBuffer))
}

function toBuffer(val) {
  return Buffer.isBuffer(val) ? val : Buffer.from(val)
}

function deinitStream(val) {
  if (!isObj(val)) return
  if (isFun(val.destroy)) val.destroy()
  else if (isFun(val.end)) val.end()
}

function isReadableStream(val) {
  return isStream(val) && isFun(val.read)
}

function isStream(val) {
  return isEmitter(val) && isFun(val.pipe)
}

function isEmitter(val) {
  return isObj(val) &&
    isFun(val.on) &&
    isFun(val.once) &&
    isFun(val.removeListener)
}

function searchAssign(search, query) {
  query = dict(query)
  for (const key in query) searchAppend(search, key, query[key])
}

function searchAppend(search, key, val) {
  if (isArr(val)) for (const elem of val) searchAppendOne(search, key, elem)
  else searchAppendOne(search, key, val)
}

function searchAppendOne(search, key, val) {
  if (isNil(val)) return
  if (isDate(val)) {
    search.append(key, val.toISOString())
    return
  }
  valid(val, isPrim)
  search.append(key, val)
}
