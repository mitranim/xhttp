'use strict'

const xhttp = require(process.cwd()).xhttp

/**
 * Utils
 */

let res, err, xhr, shouldFail

function RESET () {
  res = err = xhr = shouldFail = undefined
}

function done (_res, _xhr) {
  if (shouldFail) throw Error()
  res = _res
  xhr = _xhr
}

function fail (_err, _xhr) {
  if (!shouldFail) throw Error()
  err = _err
  xhr = _xhr
}

/**
 * Mock
 */

const UNSENT = 0
const OPENED = 1
// const HEADERS_RECEIVED = 2
// const LOADING = 3
const DONE = 4

class XMLHttpRequest {
  constructor () {
    this.readyState = UNSENT

    this.onerror = null
    this.ontimeout = null
    this.onabort = null
    this.onload = null

    this.status = 0
    this.responseText = ''

    this._method = null
    this._url = null
    this._body = null
    this._headers = []
  }

  open (method, url) {
    if (this.readyState === UNSENT) {
      this.readyState = OPENED
      this._method = method
      this._url = url
    } else {
      throw Error()
    }
  }

  send (body) {
    if (shouldFail) this._fail(body)
    else this._send(body)
  }

  _send (body) {
    if (this.readyState === OPENED) {
      this.readyState = DONE
      this.status = 200
      this.responseText = `{"succeeded": true}`
      this._body = body
      if (typeof this.onload === 'function') this.onload()
    } else {
      throw Error()
    }
  }

  _fail (body) {
    if (this.readyState === OPENED) {
      this.readyState = DONE
      this.status = 400
      this.responseText = `{"failed": true}`
      this._body = body
      if (typeof this.onerror === 'function') this.onerror()
    } else {
      throw Error()
    }
  }

  setRequestHeader (key, value) {
    if (this.readyState === OPENED) {
      this._headers.push([key, value])
    } else {
      throw Error()
    }
  }

  _getRequestHeaders () {
    const buffer = {}
    for (const pair of this._headers) {
      buffer[pair[0]] = pair[1]
    }
    return buffer
  }
}
global.XMLHttpRequest = XMLHttpRequest

/**
 * Success
 */

RESET()

xhttp({url: ''}, done, fail)

if (!res.succeeded) throw Error()
if (err != null) throw Error()
if (!(xhr instanceof XMLHttpRequest)) throw Error()

/**
 * Failure
 */

RESET()

shouldFail = true

xhttp({url: ''}, done, fail)

if (res != null) throw Error()
if (!err.failed) throw Error()
if (!(xhr instanceof XMLHttpRequest)) throw Error()

/**
 * Params
 */

RESET()

xhttp({url: '/test', method: 'post', headers: {secret: 'test'}}, done, fail)

if (!res.succeeded) throw Error()
if (err != null) throw Error()
if (!(xhr instanceof XMLHttpRequest)) throw Error()
if (xhr._method !== 'POST') throw Error()
if (xhr._url !== '/test') throw Error()
if (!xhr._getRequestHeaders().secret) throw Error()

RESET()

xhttp({url: '/test', body: {one: 1, two: 2}}, done, fail)

if (xhr._url !== '/test?one=1&two=2') throw Error()

RESET()

xhttp({url: '/test', method: 'post', body: {one: [1]}}, done, fail)

if (xhr._url !== '/test') throw Error()
if (xhr._body !== JSON.stringify({one: [1]})) throw Error()

/**
 * XHR handle
 */

RESET()

const handle = xhttp({url: ''}, done, fail)

if (!(handle instanceof XMLHttpRequest)) throw Error()

/**
 * Misc
 */

console.info(`[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}] Finished test without errors.`)
