/* eslint-disable max-len */

import * as t from './utils.mjs'

export function testCommon(h) {
  void function testUrl() {
    const testUrl = 'one://two.three/four/five?six=seven&eight=nine#ten?eleven#twelve'

    t.is(h.urlWithQuery(testUrl, undefined) instanceof URL, true)
    t.is(h.urlWithQuery(testUrl, undefined).toString(),     testUrl)
    t.is(h.urlWithQuery(testUrl, null).toString(),          testUrl)
    t.is(h.urlWithQuery(testUrl, {}).toString(),            testUrl)

    t.is(
      h.urlWithQuery(testUrl, {
        six: 'thirteen',
        eight: ['fourteen', new Date('0001-02-03T04:05:06Z')],
      }).toString(),
      'one://two.three/four/five?six=seven&eight=nine&six=thirteen&eight=fourteen&eight=0001-02-03T04%3A05%3A06.000Z#ten?eleven#twelve',
    )
  }()

  void function testParamsToJson() {
    const params = {
      method: 'post',
      url: '/',
      headers: {'connection': 'keep-alive'},
      body: {key: 'val'},
    }

    t.eqDicts(h.paramsToJson(params), {
      method: 'post',
      url: '/',
      headers: {
        'connection': 'keep-alive',
        'content-type': 'application/json',
      },
      body: '{"key":"val"}',
    })
  }()

  void function testResFromJson() {
    const res = {
      type: 'load',
      status: 200,
      ok: true,
      headers: {'connection': 'keep-alive'},
      body: '{"key":"val"}',
    }

    t.eqDicts(h.resFromJson(res), {
      type: 'load',
      status: 200,
      ok: true,
      headers: {'connection': 'keep-alive'},
      bodyText: '{"key":"val"}',
      body: {key: 'val'},
    })
  }()

  void function isStatusOk() {
    t.eq(h.isStatusOk(200), true)
    t.eq(h.isStatusOk(299), true)

    t.eq(h.isStatusOk(199),                       false)
    t.eq(h.isStatusOk(300),                       false)
    t.eq(h.isStatusOk(0),                         false)
    t.eq(h.isStatusOk(undefined),                 false)
    t.eq(h.isStatusOk({toString() {return 200}}), false)
    t.eq(h.isStatusOk('200'),                     false)
  }()
}
