'use strict'

/* eslint-disable quote-props, quotes, max-len */

const assert = require('assert')
const {inspect} = require('util')
const f = require('fpx')
const xhttp = require('../')

/**
 * Mocks
 */

class XMLHttpRequest {
  constructor() {
    this.UNSENT = 0
    this.OPENED = 1
    this.HEADERS_RECEIVED = 2
    this.LOADING = 3
    this.DONE = 4

    this.readyState = this.UNSENT

    this.onerror = null
    this.ontimeout = null
    this.onabort = null
    this.onload = null

    this.status = 0
    this.responseText = ''

    // Non-standard property set by xhttp
    this.params = null

    this.mock = {
      request: {
        method: null,
        url: null,
        headers: {},
        body: null,
      },
      response: {
        headers: {},
      },
      listeners: {},
    }
  }

  open(method, url) {
    assert.deepEqual(this.readyState, this.UNSENT,
      `Unexpected .open() call in state ${this.readyState}`)

    this.mock.request.method = method
    this.mock.request.url = url
    this.readyState = this.OPENED

    this.dispatchEvent({type: 'readystatechange', target: this})
  }

  send(body) {
    assert.deepEqual(this.readyState, this.OPENED,
      `Unexpected .send() call in state ${this.readyState}`)

    this.mock.request.body = body

    const {status, headers, text} = XMLHttpRequest.nextResponse
    const reason = XMLHttpRequest.nextResponse.reason || 'load'

    this.status = status
    this.mock.response.headers = headers
    this.responseText = text
    this.readyState = this.DONE
    this.dispatchEvent({type: 'readystatechange', target: this})

    const eventType = reason
    const methodName = `on${eventType}`
    if (f.isFunction(this[methodName])) this[methodName]({type: eventType, target: this})
    this.dispatchEvent({type: reason, target: this})
    this.dispatchEvent({type: 'loadend', target: this})
  }

  setRequestHeader(key, value) {
    assert.deepEqual(this.readyState, this.OPENED,
      `Unexpected .setRequestHeader() call in state ${this.readyState}`)
    this.mock.request.headers[key] = value
  }

  getResponseHeader(key) {
    return this.mock.response.headers[key]
  }

  getAllResponseHeaders() {
    return dictToLines(this.mock.response.headers)
  }

  addEventListener(type, fun) {
    f.validate(type, f.isString)
    f.validate(fun, f.isFunction)
    this.mock.listeners[type] = f.append(this.mock.listeners[type], fun)
  }

  dispatchEvent(event) {
    const funs = this.mock.listeners[event.type]
    if (funs) for (const fun of funs) fun.call(this, event)
  }
}

XMLHttpRequest.nextResponse = null

global.XMLHttpRequest = XMLHttpRequest

const baseResponseHeaders = {
  'date': new Date().toUTCString(),
  'last-modified': new Date().toUTCString(),
  'cache-control': 'public, max-age=0',
  'connection': 'keep-alive',
  'accept-ranges': 'bytes',
}

const jsonTypeHeaders = {'content-type': 'application/json; charset=UTF-8'}

const formdataTypeHeaders = {'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'}

function runXhrSync(params) {
  let result = null
  return [xhttp.Xhttp(params, x => {result = x}), result]
}

/**
 * Test
 */

basic_usage: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [xhr, result] = runXhrSync({url: '/'})

  assert.ok(xhr instanceof XMLHttpRequest, `Expected an XMLHttpRequest instance`)

  const resultTemplate = {
    xhr,
    // mock event
    event: {target: xhr, type: 'load'},
    // parsed params
    params: {rawParams: {url: '/'}, method: 'GET', url: '/', async: true, headers: {}, body: null},
    complete: true,
    completedAt: result.completedAt,
    reason: 'load',
    status: 200,
    ok: true,
    headers: XMLHttpRequest.nextResponse.headers,
    body: '',
  }

  assert.deepEqual(
    result,
    {
      xhr,
      // mock event
      event: {target: xhr, type: 'load'},
      // parsed params
      params: {rawParams: {url: '/'}, method: 'GET', url: '/', async: true, headers: {}, body: null},
      complete: true,
      completedAt: result.completedAt,
      reason: 'load',
      status: 200,
      ok: true,
      headers: XMLHttpRequest.nextResponse.headers,
      body: '',
    },
    `Xhttp result failed to match expected template. Expected:
${show(resultTemplate)}
Got:
${show(result)}\n`
  )

  assert.ok(
    f.isNatural(result.completedAt),
    `Expected result.completedAt to be a timestamp, got: ${show(result.completedAt)}\n`
  )
}

passthrough_request_body: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [{mock: {request}}] = runXhrSync({
    url: '/',
    method: 'post',
    body: {msg: 'hello'},
  })
  assert.deepEqual(request.body, {msg: 'hello'})
}

encode_request_body_json: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [{mock: {request}}] = runXhrSync({
    url: '/',
    method: 'post',
    headers: jsonTypeHeaders,
    body: {msg: 'hello'},
  })
  assert.deepEqual(request.body, JSON.stringify({msg: 'hello'}))
}

encode_request_body_formdata: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [{mock: {request}}] = runXhrSync({
    url: '/',
    method: 'post',
    headers: formdataTypeHeaders,
    body: {msg: 'hello world'},
  })
  assert.deepEqual(request.body, 'msg=hello%20world')
}

encode_request_body_readonly_formdata: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}

  // code duplication = defense against random mutations (just kidding)

  for (const method of ['get', 'head', 'options']) {
    const [{mock: {request}}] = runXhrSync({
      url: '/',
      method,
      body: {msg: 'hello'},
    })
    assert.deepEqual(request.body, null)
    assert.deepEqual(request.url, '/?msg=hello')
  }

  for (const method of ['get', 'head', 'options']) {
    const [{mock: {request}}] = runXhrSync({
      url: '/?blah=blah',
      method,
      body: {msg: 'hello world'},
    })
    assert.deepEqual(request.body, null)
    assert.deepEqual(request.url, '/?blah=blah&msg=hello%20world')
  }

  for (const method of ['post', 'put', 'patch', 'delete']) {
    const [{mock: {request}}] = runXhrSync({
      url: '/',
      method,
      body: {msg: 'hello world'},
    })
    assert.deepEqual(request.body, {msg: 'hello world'})
    assert.deepEqual(request.url, '/')
  }
}

passthrough_response_body: {
  const text = JSON.stringify({msg: 'hello'})
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text}
  const [__, {body}] = runXhrSync({url: '/'})
  assert.deepEqual(body, text)
}

parse_response_body_json: {
  const text = JSON.stringify({msg: 'hello'})
  XMLHttpRequest.nextResponse = {
    status: 200,
    headers: patch(baseResponseHeaders, jsonTypeHeaders),
    text,
  }
  const [__, {body}] = runXhrSync({url: '/'})
  assert.deepEqual(body, {msg: 'hello'})
}

not_ok: {
  XMLHttpRequest.nextResponse = {
    status: 400,
    headers: patch(baseResponseHeaders, jsonTypeHeaders),
    text: JSON.stringify({msg: 'UR MOM IS FAT'}),
  }
  const [__, {complete, reason, status, ok, body}] = runXhrSync({url: '/'})

  assert.deepEqual(complete, true)
  assert.deepEqual(reason, 'load')
  assert.deepEqual(status, 400)
  assert.deepEqual(ok, false)
  assert.deepEqual(body, {msg: 'UR MOM IS FAT'})
}

detect_abort: {
  XMLHttpRequest.nextResponse = {status: 0, reason: 'abort', headers: baseResponseHeaders, text: ''}
  const [__, {complete, ok, reason}] = runXhrSync({url: '/'})
  assert.deepEqual(complete, true)
  assert.deepEqual(ok, false)
  assert.deepEqual(reason, 'abort')
}

detect_error: {
  XMLHttpRequest.nextResponse = {status: 0, reason: 'error', headers: baseResponseHeaders, text: ''}
  const [__, {complete, ok, reason}] = runXhrSync({url: '/'})
  assert.deepEqual(complete, true)
  assert.deepEqual(ok, false)
  assert.deepEqual(reason, 'error')
}

detect_timeout: {
  XMLHttpRequest.nextResponse = {status: 0, reason: 'timeout', headers: baseResponseHeaders, text: ''}
  const [__, {complete, ok, reason}] = runXhrSync({url: '/'})
  assert.deepEqual(complete, true)
  assert.deepEqual(ok, false)
  assert.deepEqual(reason, 'timeout')
}

/**
 * Utils
 */

function dictToLines(dict) {
  let lines = ''
  for (const key in dict) lines += `${key}: ${dict[key]}\n`
  return lines
}

function patch(left, right) {
  const out = {}
  if (left) for (const key in left) out[key] = left[key]
  if (right) for (const key in right) out[key] = right[key]
  return out
}

function show(value) {
  return inspect(value, {depth: null})
}
