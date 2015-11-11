'use strict'

/**
 * expose xhttp using native Promise implementation, useful if targetting
 * only browsers with native Promises, if your application already Polyfills
 * Promise, or if your build tool will be shimming or transforming `Promise`
 */

module.exports = require('./lib/xhttp')(Promise)
