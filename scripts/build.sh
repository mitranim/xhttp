#!/bin/sh

function clean {
  rm -rf dist
  echo "-- deleted './dist'"
}

function makedir {
  mkdir -p dist
}

function browserify {
  node_modules/.bin/browserify lib/index.js -s xhttp > dist/xhttp.js
  echo "-- wrote file './dist/xhttp.js'"
}

function minify {
  node_modules/.bin/uglifyjs dist/xhttp.js --compress warnings=false --mangle > dist/xhttp.min.js
  echo "-- wrote file './dist/xhttp.min.js'"
}

function build {
  clean
  makedir
  browserify
  minify
}

# Build the whole thing
build
