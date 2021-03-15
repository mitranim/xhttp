import * as http from 'http'
import * as st from 'stream'
import * as f from 'fpx'
import * as t from './utils.mjs'
import * as h from '../node.mjs'
import {testCommon} from './test-common.mjs'

const PORT = 9834
const HOST = `http://localhost:${PORT}`

export const wait = t.runWithTimeout(async function testNode() {
  const srv = new http.Server()
  srv.on('request', handleRequest)

  await new Promise((done, fail) => {
    srv.listen(PORT, err => {
      if (err) fail(err)
      else done()
    })
  })

  try {
    await runNodeTest()
  }
  catch (err) {
    t.panic(err)
  }
  finally {
    srv.close()
  }
})

async function runNodeTest() {
  await testCommon(h)

  await async function testBufferStream() {
    await async function testBufferStreamToString() {
      const val = await h.bufferStream(st.Readable.from('one two three'))
      f.validate(val, f.isString)
      t.eq(val, 'one two three')
    }()

    await async function testBufferStreamToBuffer() {
      const val = await h.bufferStream(st.Readable.from(Buffer.from('one two three')))
      f.validateInstance(val, Buffer)
      t.eq(val.toString(), 'one two three')
    }()
  }()

  await async function testCombined() {
    const params = {
      url: `${HOST}/four?five#six?seven#eight`,
      query: {qKeyOne: 'qValOne', qKeyTwo: ['qValTwoOne', 'qValTwoTwo']},
      username: 'user',
      password: 'pass',
      headers: {hKeyOne: 'hValOne', hKeyTwo: ['hValTwoOne', 'hValTwoTwo']},
      body: 'bodyText',
    }

    const req = h.req(params)
    f.validateInstance(req, http.ClientRequest)

    const promise = h.wait(req)
    f.validateInstance(promise, Promise)

    const res = await promise
    t.eqDicts(res, {
      req,
      type: 'load',
      ok: true,
      complete: false,
      status: 200,
      statusText: 'OK',
      headers: res.headers,
      body: res.body,
      params,
    })

    // CBA to test the headers content: Node adds a bunch of junk.
    f.validate(res.headers, f.isDict)
    f.validateInstance(res.body, st.Readable)

    const body = JSON.parse(await h.bufferStream(res.body))

    t.eqDicts(body, {
      path: '/four?five&qKeyOne=qValOne&qKeyTwo=qValTwoOne&qKeyTwo=qValTwoTwo',
      headers: {
        hkeyone: 'hValOne',
        hkeytwo: 'hValTwoOne, hValTwoTwo',
      },
    })
  }()

  await async function testResToComplete() {
    const params = {url: HOST}
    const req = h.req(params)
    const res = await h.wait(req).then(h.resToComplete)

    t.eqDicts(res, {
      req,
      type: 'load',
      ok: true,
      complete: true,
      status: 200,
      statusText: 'OK',
      headers: res.headers,
      body: res.body,
      params,
    })

    f.validateInstance(res.body, Buffer)
    t.eq(JSON.parse(res.body), {
      path: '/',
      headers: {},
    })
  }()

  await async function testResToString() {
    const params = {url: HOST}
    const req = h.req(params)
    const res = await h.wait(req).then(h.resToString)

    t.eqDicts(res, {
      req,
      type: 'load',
      ok: true,
      complete: true,
      status: 200,
      statusText: 'OK',
      headers: res.headers,
      body: res.body,
      params,
    })

    t.eq(res.body, `{"path":"/","headers":{}}`)
  }()

  await async function testAbort() {
    const params = {url: HOST}
    const req = h.req(params)

    req.abort()

    const res = await h.wait(req)

    t.eqDicts(res, {
      req,
      type: 'abort',
      ok: false,
      complete: false,
      status: 0,
      statusText: 'aborted by client',
      headers: {},
      body: '',
      params,
    })
  }()

  await async function testResOnlyComplete() {
    await async function testResOnlyCompleteOk() {
      const params = {url: HOST}
      const req = h.req(params)
      const res = await h.wait(req).then(h.resToComplete).then(h.resOnlyComplete)

      t.eqDicts(res, {
        req,
        type: 'load',
        ok: true,
        complete: true,
        status: 200,
        statusText: 'OK',
        headers: res.headers,
        body: res.body,
        params,
      })

      t.eq(JSON.parse(res.body), {path: '/', headers: {}})
    }()

    await async function testResOnlyCompleteFail() {
      const params = {url: HOST}
      const req = h.req(params)

      req.abort()

      const err = await t.resErr(h.wait(req).then(h.resOnlyComplete))
      f.validateInstance(err, h.ResErr)

      t.eqDicts(err.res, {
        req,
        type: 'abort',
        ok: false,
        complete: false,
        status: 0,
        statusText: 'aborted by client',
        headers: {},
        body: '',
        params,
      })
    }()
  }()

  await async function testResOnlyOk() {
    await async function testResOnlyOkOk() {
      const params = {url: HOST}
      const req = h.req(params)
      const res = await h.wait(req).then(h.resToComplete).then(h.resOnlyOk)

      t.eqDicts(res, {
        req,
        type: 'load',
        ok: true,
        complete: true,
        status: 200,
        statusText: 'OK',
        headers: res.headers,
        body: res.body,
        params,
      })

      t.eq(JSON.parse(res.body), {path: '/', headers: {}})
    }()

    await async function testResOnlyOkFail() {
      const params = {url: `${HOST}/404`}
      const req = h.req(params)

      const err = await t.resErr(h.wait(req).then(h.resToComplete).then(h.resOnlyOk))
      f.validateInstance(err, h.ResErr)

      t.eqDicts(err.res, {
        req,
        type: 'load',
        ok: false,
        complete: true,
        status: 404,
        statusText: 'Not Found',
        headers: err.res.headers,
        body: err.res.body,
        params,
      })

      t.eq(JSON.parse(err.res.body), {path: '/404', headers: {}})
    }()
  }()

  // This test is fragile: it requires an internet connection, makes assumption
  // about the target server, and so on. In addition, `runWithTimeout` assumes
  // how much time is "enough" before shutting down. Might have to revise in
  // the future.
  await async function testHttps() {
    if (process.env.NODE_ENV !== 'production') return

    const params = {url: 'https://example.com'}
    const req = h.req(params)
    const res = await h.wait(req).then(h.resNormal)

    t.eqDicts(res, {
      req,
      type: 'load',
      ok: true,
      complete: true,
      status: 200,
      statusText: 'OK',
      headers: res.headers,
      body: res.body,
      params,
    })
  }()
}

function handleRequest(req, res) {
  const path = req.url
  const headers = trimHeaders(req.headers)

  if (req.method === 'GET') {
    if (req.url === '/404') res.writeHeader(404)
    res.end(JSON.stringify({path, headers}))
    return
  }

  // We must test `bufferStream` before making any requests.
  h.bufferStream(res.body)
    .then(String)
    .then(body => {
      res.end(JSON.stringify({path, headers, body}))
    })
    .catch(err => {
      res.end(err)
    })
}

// Removes headers automatically added by Node.
function trimHeaders({host: __, authorization: ___, connection: ____, ...rest}) {
  return rest
}
