'use strict'

const assert = require('assert')
const {createServer} = require('http')
const {parse: parseUrl} = require('url')
const {PassThrough} = require('stream')
const {lookup} = require('dns')
const xhttp = require('../node')

const PORT = 9834
const HOST = `http://127.0.0.1:${PORT}`

const server = startServer().once('listening', async () => {
  try {
    await runTest()
  }
  catch (err) {
    console.error(err)
    process.exit(1)
  }
  finally {
    server.close()
  }
})

/** Tests **/

async function runTest() {
  await testGet()
  await testPostPlainBody()
  await testPostStream()
  await test404()
  await testJson()
  await testAbort()
  if (!(await isInternetAvailable())) {
    console.info('Skipping internet-dependent tests')
  }
  await testHttps()
}

async function testGet() {
  const search = '?message=hello_world'
  const hash = '#hash'

  const response = await errbackPromise(done => {
    xhttp.streamingRequest({
      url: `${HOST}${search}${hash}`,
    }, done)
  })

  assert.deepEqual(response.ok, true)
  assert.deepEqual(response.status, 200)

  const body = await errbackPromise(done => {
    xhttp.bufferStream(response.body, done)
  })

  assert.ok(Buffer.isBuffer(body), `Expected buffer`)
  assert.deepEqual(String(body), `${search}${hash}`)
}

async function testPostPlainBody() {
  const body = 'Hello world!'

  const response = await errbackPromise(done => {
    xhttp.streamingRequest({
      url: HOST,
      method: 'POST',
      body,
    }, done)
  })

  assert.deepEqual(response.ok, true)
  assert.deepEqual(response.status, 200)

  const buffered = await errbackPromise(done => {
    xhttp.bufferStream(response.body, done)
  })

  assert.ok(Buffer.isBuffer(buffered), `Expected buffer`)
  assert.deepEqual(String(buffered), body)
}

async function testPostStream() {
  const msg = 'Hello world!'
  const body = new PassThrough()
  body.push(msg)
  body.end()

  const response = await errbackPromise(done => {
    xhttp.streamingRequest({
      url: HOST,
      method: 'POST',
      body,
    }, done)
  })

  assert.deepEqual(response.ok, true)
  assert.deepEqual(response.status, 200)

  const buffered = await errbackPromise(done => {
    xhttp.bufferStream(response.body, done)
  })

  assert.ok(Buffer.isBuffer(buffered), `Expected buffer`)
  assert.deepEqual(String(buffered), msg)
}

async function test404() {
  const {ok, status} = await errbackPromise(done => {
    xhttp.streamingRequest({url: `${HOST}/404`}, done)
  })
  assert.deepEqual(ok, false)
  assert.deepEqual(status, 404)
}

async function testJson() {
  const body = [{message: 'Hello world!'}]
  const response = await errbackPromise(done => {
    xhttp.jsonRequest({url: `${HOST}/json`, method: 'POST', body}, done)
  })
  assert.deepEqual(response.body, body)
}

async function testAbort() {
  try {
    await errbackPromise(done => {
      xhttp.streamingRequest({url: HOST}, done).abort()
    })
  }
  catch (err) {
    if (err instanceof xhttp.HttpError && err.response.reason === 'abort') {
      return
    }
    throw err
  }
  throw Error(`Expected an abort error`)
}

async function testHttps() {
  const {ok} = await await errbackPromise(done => {
    xhttp.bufferedRequest({url: 'https://mitranim.com'}, done)
  })
  assert.ok(ok, `Expected HTTPS request to succeed`)
}

/** Misc **/

function startServer() {
  const server = createServer(handler)
  server.listen(PORT)
  function close() {server.close()}
  process.once('exit', close)
  server.once('close', () => {process.removeListener('exit', close)})
  return server
}

function handler(req, res) {
  if (req.method === 'GET') {
    if (req.url === '/404') {
      res.writeHeader(404)
      res.end('NOT FOUND')
      return
    }

    const {search, hash} = parseUrl(req.url)
    res.end(`${search}${hash}`)
    return
  }

  if (req.url === '/json') {
    res.writeHeader(200, {'content-type': 'application/json'})
    req.pipe(res)
    return
  }

  req.pipe(res)
}

function isInternetAvailable() {
  return new Promise(resolve => {
    lookup('mitranim.com', err => {resolve(!err)})
  })
}

function errbackPromise(init) {
  return new Promise((resolve, reject) => {
    init(function done(err, val) {
      if (err) reject(err)
      else resolve(val)
    })
  })
}
