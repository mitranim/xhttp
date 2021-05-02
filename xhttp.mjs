// Browser implementation. For Node, use `./node.mjs`.
// See implementation notes in `impl.md`.

export function req(params) {
  valid(params, isParams)
  const req = new XMLHttpRequest()
  start(req, params)
  return req
}

// Browser-only API. In Node this is embedded in `req()`.
export function start(req, params) {
  valid(req, isReq)
  valid(params, isParams)

  const {method, url, query, username, password, timeout, headers, body} = params
  if (method) valid(method, isStr)

  req.params = params

  // For consistency with Node.
  if (timeout) req.timeout = timeout

  req.open(method || 'GET', urlWithQuery(url, query), true, username, password)
  sendHead(req, headers)
  req.send(body)
}

export function wait(req) {
  valid(req, isReq)
  return new Promise(function initWait(done) {
    req.onload = req.onabort = req.onerror = req.ontimeout = done
  }).then(eventToRes)
}

// In Node, this also uses `resToString` which is skippable in the browser.
// Async for consistency with Node.
export function resNormal(res) {
  return Promise.resolve(resOnlyOk(res))
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

// In Node, this buffers the response body.
// In browser, this is a noop.
// Async for consistency with Node.
export const resToComplete = resToString

// In Node, this buffers the response body.
// In browser, this is a noop.
// Async for consistency with Node.
export function resToString(res) {
  valid(res, isRes)
  const {body, ...rest} = res
  return Promise.resolve({...rest, body: str(body)})
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
  url = new URL(url, location.origin)
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

function isReq(val)       {return isInst(val, XMLHttpRequest)}
function isRes(val)       {return isDict(val) && isStr(val.type) && isBool(val.ok) && isNum(val.status)}
function isParams(val)    {return isDict(val) && isUrl(val.url)}
function isEvent(val)     {return isObj(val) && isStr(val.type) && isObj(val.target)}
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

function str(val)        {return isNil(val) ? '' : only(val, isStr)}
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

function eventToRes(event) {
  valid(event, isEvent)

  const {target: req, type} = event
  const {status, statusText, readyState} = req
  const complete = readyState === req.DONE

  return {
    req,
    type,
    ok: isStatusOk(status),
    complete,
    status,
    statusText,
    headers: headParse(req.getAllResponseHeaders()),
    body: req.responseText,
    params: req.params,
  }
}

function sendHead(req, headers) {
  headers = dict(headers)
  for (const key in headers) sendHeader(req, key, headers[key])
}

function sendHeader(req, key, val) {
  if (val == null) return

  if (isArr(val)) {
    for (const elem of val) sendHeader(req, key, elem)
    return
  }

  valid(val, isStr)
  req.setRequestHeader(key, val)
}

function headParse(headers) {
  valid(headers, isStr)

  const out = {}
  const reg = /([^\r\n:]+):(?: ([^\r\n]*))?/g

  for (;;) {
    const match = reg.exec(headers)
    if (!match) break
    const key = match[1].toLowerCase()
    out[key] = headAdd(out[key], key, match[2] || '')
  }

  return out
}

function headAdd(prev, key, val) {
  if (prev == null) return val
  if (isStr(prev)) return [prev, val]
  prev.push(val)
  return prev
}

function maybeJsonParse(val) {
  return isStr(val) ? (val ? JSON.parse(val) : null) : val
}

function preview(str) {
  valid(str, isStr)
  const limit = 128
  return str.length > limit ? `${str.slice(0, limit)} ...` : str
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
