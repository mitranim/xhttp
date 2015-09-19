'use strict'

/**
 * Basic ajax utility. Does "low"-level browser ajax with ES6 promises and
 * provides a primitive API for request / response / error interceptors.
 *
 * Expects a CommonJS environment. Doesn't depend on jQuery.
 *
 * By default, the library uses an ES6-promise shim, but you can use any
 * spec-compliant Promise constructor by directly requiring this file and
 * calling the exported function with your constructor. Examples:
 *
 *   var xhttp = require('xhttp')
 *   var xhttp = require('xhttp/custom')(Promise)
 *   var xhttp = require('xhttp/custom')(require('q').Promise)
 *   var xhttp = require('xhttp/custom')(require('bluebird'))
 */

/******************************* Dependencies ********************************/

// Custom components
var Options = require('./options')
var utils   = require('./utils')
var parse   = require('./parse')

/**************************** Generator / Export *****************************/

/**
 * Export a function that takes a promise constructor and generates a version
 * of xhttp using it.
 */

module.exports = function (promiseConstructor) {

  // Check if the constructor has the methods we need
  var isPromise = typeof promiseConstructor === 'function' &&
                  typeof promiseConstructor.prototype.then  === 'function' &&
                  typeof promiseConstructor.prototype.catch === 'function'

  // Throw an error if we didn't get a constructor with the required methods
  if (!isPromise) {
    throw new Error('the argument must be a promise constructor')
  }

  /******************************** Utilities ********************************/

  /**
   * Checks if an xhr is successful. It's considered a success if the status is
   * between 200 and 299, inclusively.
   */
  function successful (xhr) {
    return xhr.status >= 200 && xhr.status <= 299
  }

  /**
   * Response handler. Parses the response, applies the given set of
   * interceptors, and returns the resulting response value that will be
   * passed to the resolver.
   */
  function parseResponse (xhr, interceptors) {
    /**
     * Special case for response status 204: the xhr response body isn't parsed,
     * isn't passed to interceptors, and interceptor return values are ignored.
     * See http://www.w3.org/Protocols/rfc2616/rfc2616-sec10.html#sec10.2.5
     */

    if (xhr.status === 204) {
      interceptors.forEach(function (interceptor) {
        interceptor(null, xhr)
      })
      return null
    }

    /**
     * Standard case: the response is parsed in accordance with the xhr
     * options and content headers, then the interceptors are applied in
     * order. Each interceptor is called with the parsed response and the
     * native xhr object. If a non-undefined value is returned, it replaces
     * the response value for all subsequent callbacks.
     */

    var response = parse(xhr)

    interceptors.forEach(function (interceptor) {
      var result = interceptor(response, xhr)
      if (result !== undefined) response = result
    })

    // Return the parsed response
    return response
  }

  /********************************** xhttp **********************************/

  function xhttp (options) {
    return new promiseConstructor(function (resolve, reject) {
      var xhr = new XMLHttpRequest()

      // Make sure `options` and `options.headers` are writable objects
      if (!utils.isObject(options)) options = {}
      if (!utils.isObject(options.headers)) options.headers = {}

      // Apply request interceptors in order. If an interceptor returns an
      // object, it replaces the previous options
      xhttp.requestInterceptors.forEach(function (interceptor) {
        var result = interceptor(options)
        if (utils.isObject(result)) options = result
      })

      // Parse options
      options = new Options(options)

      xhr.open(
        options.method,
        options.url,
        true,  // always async
        options.username,
        options.password
      )

      // Assign headers
      utils.forOwn(options.headers, function (value, key) {
        xhr.setRequestHeader(key, value)
      })

      // Assign primitive options
      utils.assign(xhr, options.$simpleOptions())

      xhr.onerror = xhr.onabort = xhr.ontimeout = function() {
        reject(parseResponse(xhr, xhttp.errorInterceptors))
      }

      xhr.onload = function() {
        if (successful(xhr)) {
          resolve(parseResponse(xhr, xhttp.responseInterceptors))
        } else {
          reject(parseResponse(xhr, xhttp.errorInterceptors))
        }
      }

      // Send the request and let it trigger the callbacks
      xhr.send(options.data)
    })
  }

  /****************************** Interceptors *******************************/

  /**
   * `xhttp` has three groups of interceptors:
   *   requestInterceptors
   *   responseInterceptors
   *   errorInterceptors
   *
   * Request interceptors are called with `(options)`, where options is the
   * xhttp config object supplied by the user. They're allowed to mutate the
   * config object, or optionally return a new object to replace it.
   *
   * Success and error interceptors are called with `(data, xhr)`, where data
   * is the parsed response and xhr is the native XMLHttpRequest object. Like
   * with request interceptors, they can replace the data by returning a
   * non-undefined value.
   */

  xhttp.requestInterceptors = []

  xhttp.responseInterceptors = []

  xhttp.errorInterceptors = []

  // Validates and registers a request interceptor.
  xhttp.interceptRequest = function (interceptor) {
    if (typeof interceptor !== 'function') {
      throw new Error('An interceptor must be a function, got: ' + interceptor)
    }
    if (interceptor.length !== 1) {
      console.warn("Request interceptor's arity is expected to be 1, got " + interceptor.length + ":", interceptor)
    }
    xhttp.requestInterceptors.push(interceptor)
  }

  // Validates and registers a response interceptor.
  xhttp.interceptResponse = function (interceptor) {
    if (typeof interceptor !== 'function') {
      throw new Error('An interceptor must be a function, got: ' + interceptor)
    }
    xhttp.responseInterceptors.push(interceptor)
  }

  // Validates and registers an error interceptor.
  xhttp.interceptError = function (interceptor) {
    if (typeof interceptor !== 'function') {
      throw new Error('An interceptor must be a function, got: ' + interceptor)
    }
    xhttp.errorInterceptors.push(interceptor)
  }

  /******************************** "Export" *********************************/

  return xhttp
}
