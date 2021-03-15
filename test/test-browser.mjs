import * as f from 'fpx'
import * as t from './utils.mjs'
import * as h from '../xhttp.mjs'
import {testCommon} from './test-common.mjs'

/* Utils */

// Emulates `XMLHttpRequest` with sufficient accuracy.
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
    this.statusText = ''
    this.responseText = ''
    this.timeout = 0

    this.internal = {
      req: {
        open: undefined,
        headers: {},
        body: undefined,
      },
      res: {
        headers: '',
      },
      delayed: undefined,
    }
  }

  open(method, url, async, username, password) {
    t.eq(this.readyState, this.UNSENT, `Unexpected .open() call in state ${this.readyState}`)

    this.internal.req.open = {method, url, async, username, password}

    this.readyState = this.OPENED
    this.dispatchEvent({type: 'readystatechange', target: this})
  }

  send(body) {
    t.eq(this.readyState, this.OPENED, `Unexpected .send() call in state ${this.readyState}`)

    this.internal.req.body = body

    const onSendDone = () => {
      this.readyState = this.DONE
      this.dispatchEvent({type: 'readystatechange', target: this})
      this.dispatchEvent({type: 'load', target: this})
      this.dispatchEvent({type: 'loadend', target: this})
    }
    this.mockDelay(onSendDone)
  }

  setRequestHeader(key, val) {
    t.eq(this.readyState, this.OPENED, `Unexpected .setRequestHeader() call in state ${this.readyState}`)

    f.validate(key, f.isString)
    f.validate(val, f.isString)

    const headers = this.internal.req.headers
    key = key.toLowerCase()
    headers[key] = headers[key] ? `${headers[key]}, ${val}` : val
  }

  getAllResponseHeaders() {
    return this.internal.res.headers
  }

  addEventListener() {throw Error(`unsupported`)}

  dispatchEvent(event) {
    const on = this[`on${event.type}`]
    if (on) on.call(this, event)
  }

  abort() {
    const onSendDone = () => {
      this.setMockRes({})
      if (this.onabort) this.onabort({type: 'abort', target: this})
    }
    this.mockDelay(onSendDone)
  }

  getMockReqOpen() {return this.internal.req.open}
  getMockReqHead() {return this.internal.req.headers}
  getMockReqBody() {return this.internal.req.body}

  setMockRes({status = 0, statusText = '', responseText = '', headers = ''}) {
    Object.assign(this, {status, statusText, responseText})
    this.internal.res.headers = headers
  }

  mockDelay(fun) {
    if (this.internal.delayed) this.internal.delayed()
    this.internal.delayed = delay(fun)
  }
}

global.XMLHttpRequest = XMLHttpRequest

function delay(fun) {
  return f.bind(clearTimeout, setTimeout(fun))
}

/* Tests */

export const wait = t.runWithTimeout(async function testBrowser() {
  await testCommon(h)

  await async function testCombined() {
    const params = {
      timeout: 1234,
      method: 'post',
      url: 'one://two.three/four?five#six?seven#eight',
      query: {qKeyOne: 'qValOne', qKeyTwo: ['qValTwoOne', 'qValTwoTwo']},
      username: 'user',
      password: 'pass',
      headers: {hKeyOne: 'hValOne', hKeyTwo: ['hValTwoOne', 'hValTwoTwo']},
      body: 'bodyText',
    }

    const req = h.req(params)
    f.validateInstance(req, XMLHttpRequest)

    const promise = h.wait(req)
    f.validateInstance(promise, Promise)

    req.setMockRes({
      status: 200,
      statusText: 'ok',
      responseText: 'resText',
      headers: `
Connection: keep-alive
Content-Type: text/plain
      `,
    })

    const res = await promise

    t.eq(req.getMockReqOpen(), {
      method: 'post',
      url: 'one://two.three/four?five&qKeyOne=qValOne&qKeyTwo=qValTwoOne&qKeyTwo=qValTwoTwo#six?seven#eight',
      async: true,
      username: 'user',
      password: 'pass',
    })

    t.eq(req.timeout, params.timeout)

    t.eq(req.getMockReqHead(), {
      hkeyone: 'hValOne',
      hkeytwo: 'hValTwoOne, hValTwoTwo',
    })

    t.eq(req.getMockReqBody(), params.body)

    t.eqDicts(res, {
      req,
      type: 'load',
      ok: true,
      complete: true,
      status: 200,
      statusText: 'ok',
      headers: {
        'connection': 'keep-alive',
        'content-type': 'text/plain',
      },
      body: 'resText',
      params,
    })
  }()

  await async function testAbort() {
    const params = {url: '/'}
    const req = h.req(params)

    req.setMockRes({status: 200, statusText: 'ok', responseText: 'found'})
    req.abort()

    const res = await h.wait(req)

    t.eqDicts(res, {
      req,
      type: 'abort',
      ok: false,
      complete: false,
      status: 0,
      statusText: '',
      headers: {},
      body: '',
      params,
    })
  }()

  await async function testResOnlyComplete() {
    await async function testResOnlyCompleteOk() {
      const params = {url: '/'}
      const req = h.req(params)

      req.setMockRes({status: 200, statusText: 'ok', responseText: 'found'})
      const res = await h.wait(req).then(h.resOnlyComplete)

      t.eqDicts(res, {
        req,
        type: 'load',
        ok: true,
        complete: true,
        status: 200,
        statusText: 'ok',
        headers: {},
        body: 'found',
        params,
      })
    }()

    await async function testResOnlyCompleteFail() {
      const params = {url: '/'}
      const req = h.req(params)

      req.setMockRes({status: 200, statusText: 'ok', responseText: 'found'})
      req.abort()

      const err = await t.resErr(h.wait(req).then(h.resOnlyComplete))
      f.validateInstance(err, h.ResErr)

      t.eqDicts(err.res, {
        req,
        type: 'abort',
        ok: false,
        complete: false,
        status: 0,
        statusText: '',
        headers: {},
        body: '',
        params,
      })
    }()
  }()

  await async function testResOnlyOk() {
    await async function testResOnlyOkOk() {
      const params = {url: '/'}
      const req = h.req(params)

      req.setMockRes({status: 200, statusText: 'ok', responseText: 'found'})

      const res = await h.wait(req).then(h.resOnlyOk)

      t.eqDicts(res, {
        req,
        type: 'load',
        ok: true,
        complete: true,
        status: 200,
        statusText: 'ok',
        headers: {},
        body: 'found',
        params,
      })
    }()

    await async function testResOnlyOkFail() {
      const params = {url: '/'}
      const req = h.req(params)

      req.setMockRes({status: 404, statusText: 'not found', responseText: 'not found'})

      const err = await t.resErr(h.wait(req).then(h.resOnlyOk))
      f.validateInstance(err, h.ResErr)

      t.eqDicts(err.res, {
        req,
        type: 'load',
        ok: false,
        complete: true,
        status: 404,
        statusText: 'not found',
        headers: {},
        body: 'not found',
        params,
      })
    }()
  }()

  await async function testHeadParsing() {
    const params = {url: '/'}
    const req = h.req(params)

    req.setMockRes({headers: `
One: two
  three: four
  three: five, six
Seven:
Eight
    `})


    const {headers} = await h.wait(req)

    t.eq(headers, {one: 'two', '  three': ['four', 'five, six'], seven: ''})
  }()
})
