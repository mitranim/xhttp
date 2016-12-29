'use strict'

/* eslint-disable quote-props, quotes, max-len */

const {isFunction} = require('util')
const assert = require('assert')
const {Xhr} = require(process.cwd())

/**
 * Mocks
 */

class XMLHttpRequest {
  constructor () {
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

    // Non-standard props
    this.params = null
    this.result = null
    this.requestMethod = null
    this.requestUrl = null
    this.requestHeaders = {}
    this.requestBody = null
    this.responseHeaders = {}
  }

  open (method, url) {
    assert.deepEqual(this.readyState, this.UNSENT,
      `Unexpected .open() call in state ${this.readyState}`)

    this.readyState = this.OPENED
    this.requestMethod = method
    this.requestUrl = url
  }

  send (body) {
    assert.deepEqual(this.readyState, this.OPENED,
      `Unexpected .send() call in state ${this.readyState}`)

    const {status, reason, headers, text} = XMLHttpRequest.nextResponse

    this.requestBody = body
    this.readyState = this.DONE
    this.status = status
    this.responseHeaders = headers
    this.responseText = text

    const eventType = reason || 'load'
    const methodName = 'on' + eventType

    if (isFunction(this[methodName])) this[methodName]({target: this, type: eventType})
  }

  setRequestHeader (key, value) {
    assert.deepEqual(this.readyState, this.OPENED,
      `Unexpected .setRequestHeader() call in state ${this.readyState}`)
    this.requestHeaders[key] = value
  }

  getResponseHeader (key) {
    return this.responseHeaders[key]
  }

  getAllResponseHeaders () {
    return dictToLines(this.responseHeaders)
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

const jsonSendingHeaders = {'content-type': 'application/json; charset=UTF-8'}

const formdataSendingHeaders = {'content-type': 'application/x-www-form-urlencoded; charset=UTF-8'}

function XhrSync (params) {
  let result
  return [Xhr(params, x => result = x).start(), result]
}

/**
 * Test
 */

basic_usage: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [xhr, result] = XhrSync({url: '/'})

  assert(xhr instanceof XMLHttpRequest, `Expected an XMLHttpRequest instance`)

  assert.deepEqual(
    result,
    {
      xhr,
      // mock event
      event: {target: xhr, type: 'load'},
      // parsed params
      params: {rawParams: {url: '/'}, method: 'GET', url: '/', async: true, headers: {}, body: null},
      complete: true,
      reason: 'load',
      status: 200,
      ok: true,
      headers: XMLHttpRequest.nextResponse.headers,
      body: '',
    },
    `Expected result to match provided template`
  )
}

passthrough_request_body: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [{requestBody}, {params: {body}}] = XhrSync({
    url: '/',
    method: 'post',
    body: {msg: 'hello'},
  })
  assert.deepEqual(body, {msg: 'hello'})
  assert.deepEqual(requestBody, {msg: 'hello'})
}

encode_request_body_json: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [{requestBody}, {params: {body}}] = XhrSync({
    url: '/',
    method: 'post',
    headers: jsonSendingHeaders,
    body: {msg: 'hello'},
  })
  assert.deepEqual(body, JSON.stringify({msg: 'hello'}))
  assert.deepEqual(requestBody, JSON.stringify({msg: 'hello'}))
}

encode_request_body_formdata: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}
  const [{requestBody}, {params: {body}}] = XhrSync({
    url: '/',
    method: 'post',
    headers: formdataSendingHeaders,
    body: {msg: 'hello world'},
  })
  assert.deepEqual(body, 'msg=hello%20world')
  assert.deepEqual(requestBody, 'msg=hello%20world')
}

encode_request_body_readonly_formdata: {
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text: ''}

  // code duplication = defense against random mutations (just kidding)

  for (const method of ['get', 'head', 'options']) {
    const [{requestBody}, {params: {url}}] = XhrSync({
      url: '/',
      method,
      body: {msg: 'hello'},
    })
    assert.deepEqual(url, '/?msg=hello')
    assert.deepEqual(requestBody, null)
  }

  for (const method of ['get', 'head', 'options']) {
    const [{requestBody}, {params: {url}}] = XhrSync({
      url: '/?blah=blah',
      method,
      body: {msg: 'hello world'},
    })
    assert.deepEqual(url, '/?blah=blah&msg=hello%20world')
    assert.deepEqual(requestBody, null)
  }

  for (const method of ['post', 'put', 'patch', 'delete']) {
    const [{requestBody}, {params: {url}}] = XhrSync({
      url: '/',
      method,
      body: {msg: 'hello world'},
    })
    assert.deepEqual(url, '/')
    assert.deepEqual(requestBody, {msg: 'hello world'})
  }
}

passthrough_response_body: {
  const text = JSON.stringify({msg: 'hello'})
  XMLHttpRequest.nextResponse = {status: 200, headers: baseResponseHeaders, text}
  const [, {body}] = XhrSync({url: '/'})
  assert.deepEqual(body, text)
}

parse_response_body_json: {
  const text = JSON.stringify({msg: 'hello'})
  XMLHttpRequest.nextResponse = {
    status: 200,
    headers: merge(baseResponseHeaders, jsonSendingHeaders),
    text,
  }
  const [, {body}] = XhrSync({url: '/'})
  assert.deepEqual(body, {msg: 'hello'})
}

not_ok: {
  XMLHttpRequest.nextResponse = {
    status: 400,
    headers: merge(baseResponseHeaders, jsonSendingHeaders),
    text: JSON.stringify({msg: 'UR MOM IS FAT'}),
  }
  const [, {complete, reason, status, ok, body}] = XhrSync({url: '/'})

  assert.deepEqual(complete, true)
  assert.deepEqual(reason, 'load')
  assert.deepEqual(status, 400)
  assert.deepEqual(ok, false)
  assert.deepEqual(body, {msg: 'UR MOM IS FAT'})
}

detect_abort: {
  XMLHttpRequest.nextResponse = {status: 0, reason: 'abort', headers: baseResponseHeaders, text: ''}
  const [, {complete, ok, reason}] = XhrSync({url: '/'})
  assert.deepEqual(complete, true)
  assert.deepEqual(ok, false)
  assert.deepEqual(reason, 'abort')
}

detect_error: {
  XMLHttpRequest.nextResponse = {status: 0, reason: 'error', headers: baseResponseHeaders, text: ''}
  const [, {complete, ok, reason}] = XhrSync({url: '/'})
  assert.deepEqual(complete, true)
  assert.deepEqual(ok, false)
  assert.deepEqual(reason, 'error')
}

detect_timeout: {
  XMLHttpRequest.nextResponse = {status: 0, reason: 'timeout', headers: baseResponseHeaders, text: ''}
  const [, {complete, ok, reason}] = XhrSync({url: '/'})
  assert.deepEqual(complete, true)
  assert.deepEqual(ok, false)
  assert.deepEqual(reason, 'timeout')
}

/**
 * Utils
 */

function dictToLines (dict) {
  let lines = ''
  for (const key in dict) lines += `${key}: ${dict[key]}\n`
  return lines
}

function merge (...args) {
  return args.reduce(assignOne, {})
}

function assignOne (left, right) {
  return Object.assign(left, right)
}

/**
 * Misc
 */

console.info(`[${new Date().getHours()}:${new Date().getMinutes()}:${new Date().getSeconds()}] Finished test without errors.`) // eslint-disable-line
