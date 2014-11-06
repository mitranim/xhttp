'use strict'

/**
* Returns the response data of an xhr request.
*/

/******************************* Dependencies ********************************/

// Custom components
var utils = require('./utils')

/********************************* Utilities *********************************/

/**
* Converts a form-encoded string into a hash.
*/
function deform (string) {
  var buffer = {},
      pair, key, value

  // Loop over key=value pairs, decode key and value, and assign to buffer
  string.split('&').forEach(function (item) {
    pair = item.split('=')
    key = decodeURIComponent(pair[0])
    value = decodeURIComponent(pair[1])

    buffer[key] = value
  })

  return buffer
}

/**
* Tries to decode the data of an xhr request based on its content-type header.
* We can decode data sent as json or form-encoded.
*/
function parse (xhr) {
  var response    = xhr.response,
      contentType = xhr.getResponseHeader('Content-Type')

  if (utils.typeRegs.json.test(contentType)) {
    return JSON.parse(response)
  }

  if (utils.typeRegs.form.test(contentType)) {
    return typeof response === 'string' ? deform(response) : response
  }

  return response
}

/********************************** Export ***********************************/

module.exports = parse
