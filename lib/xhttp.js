'use strict'

/**
* Basic ajax utility. Does "low"-level browser ajax with ES6 promises
* and provides a primitive API for request / response / error interceptors.
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
*   var xhttp = require('xhttp/custom')(require('bluebird').Promise)
*/

/******************************* Dependencies ********************************/

// Custom components
var Options = require('./options'),
    utils   = require('./utils'),
    parse   = require('./parse')

/**************************** Generator / Export *****************************/

/**
* We export a function that takes a promise constructor and generates an
* xhttp function using it.
*/

module.exports = function (promiseConstructor) {

  /**
  * Check if the constructor has the methods we need.
  */
  var isPromise = typeof promiseConstructor === 'function' &&
                  typeof promiseConstructor.prototype.then === 'function' &&
                  typeof promiseConstructor.prototype.catch === 'function'

  /**
  * Throw an error if we didn't get a constructor with the required methods.
  */
  if (!isPromise) {
    throw new Error('the argument must be a promise constructor')
  }

  /******************************** Utilities ********************************/

  /**
  * Checks if an xhr is successful. It's considered a success if the status
  * is between 200 and 299, inclusively.
  */
  function successful (xhr) {
    return xhr.status >= 200 && xhr.status <= 299
  }

  /**
  * Failure handler. Applies error interceptors and calls the given
  * promise rejecter.
  */
  function handleFailure (xhr, reject) {
    /**
    * Apply error interceptors in order. Each interceptor is called with
    * the parsed response (if any) and the xhr object.
    */

    var response = parse(xhr)

    xhttp.errInterceptors.forEach(function (interceptor) {
      interceptor(response, xhr)
    })

    // Reject the promise
    reject(response)
  }

  /**
  * Success handler. Applies success interceptors and calls the given
  * promise resolver.
  */
  function handleSuccess (xhr, resolve) {
    /**
    * Apply response interceptors in order. Each interceptor is called with
    * the parsed response and the native xhr object. If a non-undefined value is
    * returned, it replaces the parsed data object for all subsequent callbacks.
    */

    var response = parse(xhr)

    xhttp.resInterceptors.forEach(function (interceptor) {
      var result = interceptor(response, xhr)
      if (result !== undefined) response = result
    })

    // Forward the data to the user callback
    resolve(response)
  }

  /********************************** xhttp **********************************/

  function xhttp (options) {
    return new promiseConstructor(function (resolve, reject) {

      // Parse the options into an options object
      options = new Options(options)

      // Make the new request object
      var xhr = new XMLHttpRequest()

      // Open with the given options
      xhr.open(
        options.method,
        options.url,
        true,  // always async
        options.username,
        options.password
      )

      /**
      * Apply request interceptors in order. Each interceptor is called with
      * one argument: the `data` attribute of the options object. If a
      * non-undefined value is returned, it replaces the data attribute.
      */
      if (!options.$noBody()) {
        xhttp.reqInterceptors.forEach(function (interceptor) {
          var result = interceptor(options.data)
          if (result !== undefined) options.data = result
        })
      }

      // Assign the headers
      utils.forOwn(options.headers, function (value, key) {
        xhr.setRequestHeader(key, value)
      })

      // Assign primitive options
      utils.assign(xhr, options.$simpleOptions())

      // Attach a failure listener
      xhr.onabort = xhr.onerror = xhr.ontimeout = function() {
        handleFailure(xhr, resolve)
      }

      // Attach a success listener
      xhr.onloadend = function() {
        if (successful(xhr)) {
          handleSuccess(xhr, resolve)
        } else {
          handleFailure(xhr, reject)
        }
      }

      // Send the request and let it trigger the callbacks
      xhr.send(options.data)
    })
  }

  /****************************** Interceptors *******************************/

  /**
  * `xhttp` has three groups of interceptors:
  *   reqInterceptors
  *   resInterceptors
  *   errInterceptors
  *
  * Request interceptors are called with `(data)`, where data is the data passed
  * in the xhttp config object supplied by the user. If an interceptor returns
  * a non-undefined value, the value replaces the data. If the request method
  * implies no body (like GET), request interceptors are ignored.
  *
  * Success interceptors are called with `(data, xhr)`, where data is the parsed
  * response and xhr is the native XMLHttpRequest object. Like with request
  * interceptors, they can replace the data by returning a non-undefined value.
  *
  * Error interceptors are called with the same arguments as success interceptors,
  * but no argument substitution is made.
  */

  xhttp.reqInterceptors = []

  xhttp.resInterceptors = []

  xhttp.errInterceptors = []

  xhttp.addReqInterceptor = function (/* ... interceptors */) {
    xhttp.reqInterceptors.push.apply(xhttp.reqInterceptors, arguments)
  }

  xhttp.addResInterceptor = function (/* ... interceptors */) {
    xhttp.resInterceptors.push.apply(xhttp.resInterceptors, arguments)
  }

  xhttp.addErrInterceptor = function (/* ... interceptors */) {
    xhttp.errInterceptors.push.apply(xhttp.errInterceptors, arguments)
  }

  /******************************** "Export" *********************************/

  return xhttp

}
