'use strict'

/**
 * Parses the options for an xhttp request.
 */

/******************************* Dependencies ********************************/

// Custom components
var utils = require('./utils')

/********************************** Globals **********************************/

/**
 * List of keys that can be assigned from options to xhr directly.
 */
var simpleOptions = ['timeout', 'withCredentials']

/**
 * Default options.
 */
var defaults = {
  timeout: 10000,
  withCredentials: false
}

/******************************** Constructor ********************************/

/**
 * The options class. Parses the given options hash on initialisation.
 */
function Options (attributes) {
  // Make sure attributes are an object
  attributes = utils.toHash(attributes)

  // Assign defaults to self
  utils.assign(this, defaults)

  // Assign attributes to self
  utils.assign(this, attributes)

  /** Parse own properties */

  // Adjust the HTTP method
  this.$parseMethod()

  // Adjust the URL
  this.$parseUrl()

  // Adjust headers and detect content type
  this.$parseHeaders()

  // Adjust data depending on content type
  this.$parseData()
}

/********************************* Prototype *********************************/

/**
 * Figures out the HTTP method. It must be a string, we uppercase it to match
 * the spec, and the default is GET.
 */
Options.prototype.$parseMethod = function() {
  // Old method value
  var value = this.method

  if (typeof value !== 'string' || !value) this.method = 'GET'
  else this.method = value.toUpperCase()
}

/**
 * Figures out the URL based on the provided base string and parameters.
 */
Options.prototype.$parseUrl = function() {
  // Mandate some kind of string URL provided
  if (typeof this.url !== 'string' || !this.url) {
    throw new Error('an URL string is required')
  }

  // Join with params
  this.url = this.url + this.$makeParams()
}

/**
 * Returns a query string made of own params.
 */
Options.prototype.$makeParams = function() {
  var query = utils.formEncode(this.params)
  if (query) query = '?' + query
  return query
}

/**
 * Adjusts `options.headers`. Makes sure it's a hash, clones for safety, and
 * sets the content type if relevant and possible. Has no effect if
 * `options.contentType` is set to false.
 */
Options.prototype.$parseHeaders = function() {
  this.headers = utils.toHash(this.headers)

  // Quit if automatic content-type is disabled
  if (this.contentType != null && !this.contentType) return

  if (!this.headers['Content-Type']) {
    var type = utils.types[this.type] || this.$guessContentType()
    if (type) {
      this.headers['Content-Type'] = type
    }
  }
}

/**
 * Tries to guess the content-type based on the data. If data is an object,
 * this defaults to application/json.
 */
Options.prototype.$guessContentType = function() {
  if (!this.hasOwnProperty('data')) return

  if (typeof this.data === 'string') return utils.types.plain

  if (utils.isObject(this.data)) return utils.types.json
}

/**
 * Adjusts `this.data`. If we're using a no-body method, it's deleted from the
 * options. If it's not a string and we know how to convert it, it's converted.
 * Otherwise it's left unchanged. Has no effect if `options.processData` is set
 * to false.
 */
Options.prototype.$parseData = function() {
  if (this.processData != null && !this.processData) return
  if (!this.hasOwnProperty('data')) return

  // When using one of the "safe" methods, the body should be ignored
  if (this.$safeMethod()) {
    this.data = null
    return
  }

  // Already a string -> leave as-is
  if (typeof this.data === 'string') return

  var contentType = this.headers['Content-Type']

  // If JSON, stringify it
  if (utils.typeRegs.json.test(contentType)) {
    this.data = JSON.stringify(this.data)
    return
  }

  // If form-encoded, stringify it
  if (utils.typeRegs.form.test(contentType)) {
    this.data = utils.formEncode(this.data)
    return
  }
}

/**
 * Checks if we're using a method that doesn't send a request body.
 */
Options.prototype.$safeMethod = function() {
  return this.method === 'GET' || this.method === 'HEAD' || this.method === 'OPTIONS'
}

/**
 * Returns a hash of own properties that correspond to writable properties of
 * the xhr object and can be directly assigned to it.
 */
Options.prototype.$simpleOptions = function() {
  var buffer = {}

  utils.forOwn(this, function (value, key) {
    if (!~simpleOptions.indexOf(key)) return
    buffer[key] = value
  })

  return buffer
}

/********************************** Export ***********************************/

module.exports = Options
