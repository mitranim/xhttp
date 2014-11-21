'use strict'

/**
* Utils for other xhttp modules.
*/

/**************************** Utilities / Export *****************************/

/**
* Table to map options.type to options.headers['Content-Type'].
*/
var types = {
  'plain'     : 'text/plain; charset=utf-8',
  'json'      : 'application/json; charset=utf-8',
  'form'      : 'application/x-www-form-urlencoded; charset=utf-8'
}
exports.types = types

/**
* Content-type checker regexes.
*/
var typeRegs = {
  'plain'     : /text\/plain/i,
  'json'      : /application\/json/i,
  'form'      : /application\/x-www-form-urlencoded/i
}
exports.typeRegs = typeRegs

/**
* Checks if something is an object. As in, you can read properties from it
* and set properties to it.
*/
function isObject (value) {
  return value !== null && typeof value === 'object'
}
exports.isObject = isObject

/**
* `hasOwnProperty` that works for objects that don't have this method.
* (E.g. hash tables created with Object.create(null).)
*/
function ownProp (object, key) {
  return Object.hasOwnProperty.call(object, key)
}
exports.ownProp = ownProp

/**
* Loops over own enumerable properties of an object, calling the callback on
* each value with own execution context. Call this function with .call or
* .apply to use a different execution context.
*/
function forOwn (object, callback) {
  if (!isObject(object)) return

  for (var key in object) {
    if (!ownProp(object, key)) continue

    callback.call(this, object[key], key)
  }
}
exports.forOwn = forOwn

/**
* Assigns own enumerable properties of the given source object to the given
* target object. If the target is not an object, a new empty object is used
* in its place. Returns the target object.
*/
function assign (target, source) {
  if (!isObject(target)) target = {}
  if (!isObject(source)) return target

  forOwn(source, function (value, key) {
    target[key] = value
  })

  return target
}
exports.assign = assign

/**
* Makes sure value is an object and makes a shallow clone.
*/
function toHash (object) {
  if (!isObject(object)) return {}

  var buffer = {}

  forOwn(object, function (value, key) {
    buffer[key] = value
  })

  return buffer
}
exports.toHash = toHash

/**
* Converts a given hash into a query string. Ignores non-truthy values (except
* zero) and non-truthy keys like ''. Useable for URLs or form-encoded URL
* bodies. Always returns a string.
*/
function formEncode (object) {
  var result = []

  // Form key-value pairs, encoding each key and value
  forOwn(object, function (value, key) {
    if (!value && value !== 0 || !key) return
    result.push(encodeURIComponent(key) + '=' + encodeURIComponent(value))
  })

  return result.join('&')
}
exports.formEncode = formEncode
