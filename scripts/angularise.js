'use strict'

/******************************* Dependencies ********************************/

var fs = require('fs')

/********************************** Globals **********************************/

var lib = './lib/'

var dist = './dist/tmp/'

/********************************* Utilities *********************************/

// Gets the names of all files in a given location
function getFiles (dir) {
  return fs.readdirSync(dir).map(function (name) {
    return name
  }).filter(function (name) {
    return fs.statSync(dir + name).isFile()
  })
}

// Gets the list of .js files in lib
function getJSFiles() {
  return getFiles(lib).filter(function (name) {
    return /\.js$/.test(name)
  })
}

/*********************************** Build ***********************************/

/**
* Get the list of files in the lib directory. Then process each file
* and write it to dist.
*/
getJSFiles().forEach(function (name) {
  // Get the file contents
  var file = fs.readFileSync(lib + name, 'utf8')

  /**
  * Adapt each file to the angular environment by replacing `require` calls
  * for third party libraries with references to the ways we get these
  * dependencies in angular.
  */
  var adapted = file
    .replace(/require\('es6-promise'\)/g, '$q')
    .replace(/require\('xhttp'\)/g, '$http')
    .replace(/require\('lodash'\)/g, 'window._')

  // Specify in utils that this is a build for angular
  if (name === 'utils.js') {
    adapted = adapted.replace(/exports\.angular = false/g, 'exports.angular = true')
  }

  // Write the file to the dist directory
  fs.writeFileSync(dist + name, adapted, 'utf8')

  console.log("-- wrote file '" + dist + name + "'")
})
