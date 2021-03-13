import {wait as waitBrowser} from './test-browser.mjs'
import {wait as waitNode} from './test-node.mjs'

Promise.all([waitBrowser, waitNode]).then(function done() {
  console.log('[test] ok')
})
