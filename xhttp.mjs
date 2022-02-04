export const GET = `GET`
export const HEAD = `HEAD`
export const OPTIONS = `OPTIONS`
export const POST = `POST`
export const PUT = `PUT`
export const PATCH = `PATCH`
export const DELETE = `DELETE`

export const CONTENT_TYPE = `content-type`
export const TYPE_JSON = `application/json`
export const HEAD_JSON = Object.freeze({[CONTENT_TYPE]: TYPE_JSON})

export function jsonDecode(val) {return str(val) ? JSON.parse(val) : null}
export function jsonEncode(val) {return JSON.stringify(isNil(val) ? null : val)}

export function isErrWith(err, code) {
  return isInst(err, Error) && isNat(code) && err.status === code
}

export class Err extends Error {
  constructor(message, status, res) {
    req(message, isStr)
    req(status, isNat)
    optInst(res, Response)

    super((status ? status + `: ` : ``) + message)
    this.status = status
    this.res = res
  }

  get name() {return this.constructor.name}
}

export class Req {
  async fetch() {return this.Res.from(await fetch(this.req()))}
  async fetchOk() {return (await this.fetch()).okRes()}
  async fetchOkText() {return (await this.fetch()).okText()}
  async fetchOkJson() {return (await this.fetch()).okJson()}

  mut({headers, ...rest}) {
    Object.assign(this, rest)
    this.head().mut(headers)
    return this
  }

  req() {return new Request(this.url, this)}
  to(val) {return this.url = val, this}
  sig(val) {return this.signal = val, this}
  meth(val) {return this.method = str(val) || undefined, this}
  inp(val) {return this.body = val, this}
  json(val) {return this.inp(jsonEncode(val)).headSet(CONTENT_TYPE, TYPE_JSON)}

  get() {return this.meth(GET)}
  post() {return this.meth(POST)}
  put() {return this.meth(PUT)}
  patch() {return this.meth(PATCH)}
  delete() {return this.meth(DELETE)}

  head() {return this.headers || (this.headers = new this.Head())}
  headSet(key, val) {return this.head().set(key, val), this}
  headAppend(key, val) {return this.head().append(key, val), this}
  headDelete(key) {return this.head().delete(key), this}
  headMut(key) {return this.head().mut(key), this}

  get Head() {return Head}
  get Res() {return Res}
  get [Symbol.toStringTag]() {return this.constructor.name}
}

export class Res extends Response {
  constructor(body, init, res) {
    super(body, init)
    this.res = reqInst(res, Response)
  }

  get redirected() {return this.res.redirected}
  get type() {return this.res.type}
  get url() {return this.res.url}

  async okRes() {
    if (!this.ok) {
      const msg = (await this.text()) || `unknown fetch error`
      throw new Err(msg, this.status, this)
    }
    return this
  }

  async okText() {return (await this.okRes()).text()}
  async okJson() {return (await this.okRes()).json()}

  static from(res) {
    reqInst(res, Response)
    return new this(res.body, res, res)
  }

  get [Symbol.toStringTag]() {return this.constructor.name}
}

export class Head extends Headers {
  mut(src) {
    for (const [key, val] of entries(src)) this.set(key, val)
    return this
  }

  set(key, val) {
    req(key, isStr)
    req(val, isStr)
    super.set(key, val)
    return this
  }

  append(key, val) {
    req(key, isStr)
    req(val, isStr)
    super.append(key, val)
    return this
  }

  clear() {for (const key of [...this.keys()]) this.delete(key)}

  get [Symbol.toStringTag]() {return this.constructor.name}
}

function entries(val) {
  return isIter(val) && hasMeth(val, `entries`) ? val.entries() : Object.entries(val)
}

function isNil(val) {return val == null}
function isNum(val) {return typeof val === `number`}
function isInt(val) {return isNum(val) && ((val % 1) === 0)}
function isNat(val) {return isInt(val) && val >= 0}
function isStr(val) {return typeof val === `string`}
function isComp(val) {return isObj(val) || isFun(val)}
function isFun(val) {return typeof val === `function`}
function isObj(val) {return !isNull(val) && typeof val === `object`}
function isArr(val) {return Array.isArray(val)}
function isIter(val) {return hasMeth(val, Symbol.iterator)}
function isCls(val) {return isFun(val) && isObj(val.prototype)}
function isDict(val) {return isObj(val) && isDictProto(Object.getPrototypeOf(val))}

function isNull(val) {return val === null} // eslint-disable-line eqeqeq
function isDictProto(val) {return isNull(val) || val === Object.prototype}

function isInst(val, cls) {
  req(cls, isCls)
  return isObj(val) && val instanceof cls
}

function hasMeth(val, key) {return isComp(val) && key in val && isFun(val[key])}

function show(val) {
  if (isStr(val) || isArr(val) || isDict(val) || (isComp(val) && !hasMeth(val, `toString`))) {
    try {return JSON.stringify(val)} catch {}
  }
  return (isFun(val) && val.name) || String(val)
}

function req(val, fun) {
  reqValidator(fun)
  if (!fun(val)) {
    throw TypeError(`expected ${show(val)} to satisfy test ${show(fun)}`)
  }
  return val
}

function reqValidator(fun) {
  if (!isFun(fun)) {
    throw TypeError(`expected validator function, got ${show(fun)}`)
  }
}

function reqInst(val, cls) {
  if (!isInst(val, cls)) {
    const cons = isComp(val) ? val.constructor : undefined
    throw TypeError(`expected ${show(val)}${cons ? ` (instance of ${show(cons)})` : ``} to be an instance of ${show(cls)}`)
  }
  return val
}

function optInst(val, cls) {
  req(cls, isCls)
  return isNil(val) ? val : reqInst(val, cls)
}

function str(val) {return isNil(val) ? `` : req(val, isStr)}
