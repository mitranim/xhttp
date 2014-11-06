'use strict'

/******************************* Dependencies ********************************/

var fs = require('fs')

/********************************** Globals **********************************/

/**
* Expect to have an adapted (with dependencies replaced) and browserified
* version of Record at this location.
*/
var fileName = './dist/record.js'

/********************************* Utilities *********************************/

/**
* Prepends an indent to each line in the given string
*/
function indent (string) {
  return string.replace(/^/gm, '    ')
}

/*********************************** Wrap ************************************/

// Read the file contents
var file = fs.readFileSync(fileName, 'utf8')

// Indent the file to match the wrapper indentation
var indented = indent(file)

// Wrap the file into an angular factory
var wrapped =
  ";(function (angular) {\n" +
  "\n" +
  "  angular.module('Record', []).factory('Record', ['$http', '$q', function ($http, $q) {\n" +
  "\n" +
      indented +
  "\n" +
  "\n" +
  "    return window.Record;\n" +
  "  }]);\n" +
  "\n" +
  "})(window.angular);\n"

// Write the wrapped version to the disk
fs.writeFileSync(fileName, wrapped, 'utf8')

console.log("-- wrote file '" + fileName + "'")
