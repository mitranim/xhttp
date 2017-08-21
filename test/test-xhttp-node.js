'use strict'

const assert = require('assert')
const {createServer} = require('http')
const {parse: parseUrl} = require('url')
const {PassThrough} = require('stream')
const {lookup} = require('dns')
const {Future} = require('posterus')
const {routine} = require('posterus/routine')
const {streamingRequest, bufferBody, jsonRequest} = require('../node')

const PORT = 9834
const HOST = `http://127.0.0.1:${PORT}`

const server = startServer().once('listening', () => {
  routine(runTest()).map(error => {
    server.close()
    if (error) throw error
  })
})

function* runTest() {
  yield testGet()
  yield testPostPlainBody()
  yield testPostStream()
  yield test404()
  yield testJson()
  if (!(yield isInternetAvailable())) {
    console.info('Skipping internet-dependent tests')
  }
  yield testHttps()
}

function* testGet() {
  const search = '?message=hello_world'
  const hash = '#hash'

  const response = yield streamingRequest({
    url: `${HOST}${search}${hash}`,
  })

  assert.deepEqual(response.ok, true)
  assert.deepEqual(response.status, 200)

  const {body} = yield bufferBody(response)

  assert.deepEqual(String(body), `${search}${hash}`)
}

function* testPostPlainBody() {
  const body = 'Hello world!'

  const response = yield streamingRequest({
    url: `${HOST}`,
    method: 'POST',
    body,
  })

  assert.deepEqual(response.ok, true)
  assert.deepEqual(response.status, 200)

  const buffered = yield bufferBody(response)

  assert.deepEqual(buffered.ok, true)
  assert.deepEqual(buffered.status, 200)
  assert.ok(Buffer.isBuffer(buffered.body), `Expected a fully buffered body`)
  assert.deepEqual(String(buffered.body), body)
}

function* testPostStream() {
  const msg = 'Hello world!'
  const body = new PassThrough()
  body.push(msg)
  body.end()

  const response = yield streamingRequest({
    url: `${HOST}`,
    method: 'POST',
    body,
  })

  assert.deepEqual(response.ok, true)
  assert.deepEqual(response.status, 200)

  const buffered = yield bufferBody(response)

  assert.deepEqual(buffered.ok, true)
  assert.deepEqual(buffered.status, 200)
  assert.ok(Buffer.isBuffer(buffered.body), `Expected a fully buffered body`)
  assert.deepEqual(String(buffered.body), msg)
}

function* test404() {
  const {ok, status} = yield streamingRequest({url: `${HOST}/404`})
  assert.deepEqual(ok, false)
  assert.deepEqual(status, 404)
}

function* testJson() {
  const body = [{message: 'Hello world!'}]
  const response = yield jsonRequest({url: `${HOST}/json`, method: 'POST', body})
  assert.deepEqual(response.body, body)
}

function* testHttps() {
  const {ok} = yield streamingRequest({url: 'https://mitranim.com'}).mapResult(bufferBody)
  assert.ok(ok, `Expected HTTP request to succeed`)
}

function startServer() {
  const server = createServer(handler)
  server.listen(PORT)
  process.once('exit', () => {server.close()})
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
  return Future.init(future => {
    lookup('mitranim.com', err => {
      future.settle(null, !err)
    })
  })
}
