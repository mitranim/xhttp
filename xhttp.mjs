// Browser implementation. For Node, use `./node.mjs`.
// See implementation notes in `impl.md`.

export function req(params) {
  validate(params, isParams)
  const req = new XMLHttpRequest()
  start(req, params)
  return req
}

// Browser-only API. In Node this is embedded in `req()`.
export function start(req, params) {
  validate(req, isReq)
  validate(params, isParams)

  const {method, url, query, username, password, timeout, head, body} = params
  if (method) validate(method, isString)

  req.params = params

  // For symmetry with Node.
  if (timeout) req.timeout = timeout

  req.open(method || 'get', urlWithQuery(url, query), true, username, password)
  sendHead(req, head)
  req.send(body)
}

export function wait(req) {
  validate(req, isReq)
  return new Promise(function initWait(done) {
    req.onload = req.onabort = req.onerror = req.ontimeout = done
  }).then(eventToRes)
}

// In Node, this also uses `resToString` which is skippable in the browser.
export function resNormal(res) {
  return resOnlyOk(res)
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

// In Node, this buffers the response body. In browser, this is a noop.
export const resToComplete = resToString

// In Node, this buffers the response body. In browser, this is a noop.
export function resToString(res) {
  validate(res, isRes)
  const {body, ...rest} = res
  return {...rest, body: onlyString(body)}
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
  return isInstance(val, XMLHttpRequest)
}

function isRes(val) {
  return isDict(val) && isString(val.type) && isBoolean(val.ok) && isNumber(val.status)
}

function isParams(val) {
  return isDict(val) && isString(val.url)
}

function isEvent(val) {
  return isObject(val) && isString(val.type) && isObject(val.target)
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

function eventToRes(event) {
  validate(event, isEvent)

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
    head: headParse(req.getAllResponseHeaders()),
    body: req.responseText,
    params: req.params,
  }
}

function sendHead(req, head) {
  head = onlyDict(head)
  for (const key in head) sendHeader(req, key, head[key])
}

function sendHeader(req, key, val) {
  if (val == null) return

  if (isArray(val)) {
    for (const elem of val) sendHeader(req, key, elem)
    return
  }

  validate(val, isString)
  req.setRequestHeader(key, val)
}

function queryFormatPair(key, val) {
  if (!key) return ''

  if (isArray(val)) {
    let out = ''
    for (const elem of val) out = searchJoin(out, queryFormatPair(key, elem))
    return out
  }

  validate(val, isString)
  return `${key}=${val}`
}

function urlWithoutHash(url) {
  const ind = url.indexOf('#')
  return ind >= 0 ? url.slice(0, ind) : url
}

function headParse(head) {
  validate(head, isString)

  const out = {}
  const reg = /([^\r\n:]+):(?: ([^\r\n]*))?/g

  for (;;) {
    const match = reg.exec(head)
    if (!match) break
    const key = match[1].toLowerCase()
    out[key] = headAdd(out[key], key, match[2] || '')
  }

  return out
}

function headAdd(prev, key, val) {
  if (prev == null) return val
  if (isString(prev)) return [prev, val]
  prev.push(val)
  return prev
}

function maybeJsonParse(val) {
  return isString(val) ? (val ? JSON.parse(val) : null) : val
}

function preview(str) {
  validate(str, isString)
  const limit = 128
  return str.length > limit ? `${str.slice(0, limit)} ...` : str
}
