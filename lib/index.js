'use strict'

/**
* Default version of xhttp. Uses an ES6 promise shim.
*
* The user can supply a custom promise constructor, see notes in `xhttp.js`.
*/

/******************************* Dependencies ********************************/

// Third party
var Promise = require('es6-promise').Promise

// Custom components
var xhttp = require('./xhttp')

/********************************** Export ***********************************/

module.exports = xhttp(Promise)
