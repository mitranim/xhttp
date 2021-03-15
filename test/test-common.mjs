import * as t from './utils.mjs'

export function testCommon(h) {
  void function testUrl() {
    const testUrl = 'one://two.three/four/five?six=seven&eight=nine#ten?eleven#twelve'

    t.eq(h.urlBase(testUrl), 'one://two.three/four/five')
    t.eq(h.urlSearch(testUrl), 'six=seven&eight=nine')
    t.eq(h.urlHash(testUrl), 'ten?eleven#twelve')

    t.eq(h.urlJoin('one://two.three/four/five', 'six=seven&eight=nine', 'ten?eleven#twelve'), testUrl)
    t.eq(h.urlJoin('one', '', ''), 'one')
    t.eq(h.urlJoin('one', 'two', ''), 'one?two')
    t.eq(h.urlJoin('one', 'two', 'three'), 'one?two#three')
    t.eq(h.urlJoin('one', '', 'three'), 'one#three')
    t.eq(h.urlJoin('', 'two', ''), '?two')
    t.eq(h.urlJoin('', 'two', 'three'), '?two#three')
    t.eq(h.urlJoin('', '', 'three'), '#three')

    t.eq(h.queryFormat({date: new Date('0001-02-03T04:05:06Z')}), `date=0001-02-03T04:05:06.000Z`)
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
