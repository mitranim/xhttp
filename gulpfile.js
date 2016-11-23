'use strict'

/** **************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const del = require('del')
const gulp = require('gulp')
const {exec} = require('child_process')

/** ******************************* Globals **********************************/

const src = {
  lib: 'src/**/*.js',
  jsnext: 'dist-jsnext/**/*.js',
  main: 'dist/**/*.js',
}

const out = {
  jsnext: 'dist-jsnext',
  main: 'dist',
}

const test = 'test/**/*.js'

const testCommand = require('./package').scripts.test

function noop () {}

const babelConfigJsNext = {
  plugins: [
    'check-es2015-constants',
    'transform-es2015-arrow-functions',
    'transform-es2015-block-scoping',
    ['transform-es2015-destructuring', {loose: true}],
    'transform-es2015-function-name',
    'transform-es2015-literals',
    'transform-es2015-parameters',
    'transform-es2015-shorthand-properties',
    ['transform-es2015-spread', {loose: true}],
    'transform-es2015-template-literals',
  ]
}

const babelConfigMain = {
  plugins: babelConfigJsNext.plugins.concat('transform-es2015-modules-commonjs')
}

/** ******************************** Tasks ***********************************/

gulp.task('clear', () => (
  del([out.main, out.jsnext]).catch(noop)
))

gulp.task('compile:jsnext', () => (
  gulp.src(src.lib)
    .pipe($.babel(babelConfigJsNext))
    .pipe(gulp.dest(out.jsnext))
))

gulp.task('compile:main', () => (
  gulp.src(src.lib)
    .pipe($.babel(babelConfigMain))
    .pipe(gulp.dest(out.main))
))

gulp.task('compile', gulp.parallel('compile:jsnext', 'compile:main'))

gulp.task('minify', () => (
  gulp.src(src.main)
    .pipe($.uglify({mangle: true, compress: {warnings: false, screw_ie8: true}}))
    .pipe($.rename(path => {
      path.extname = '.min.js'
    }))
    .pipe(gulp.dest(out.main))
))

gulp.task('test', done => {
  exec(testCommand, (err, stdout) => {
    // This also contains stderr output.
    process.stdout.write(stdout)
    done(err)
  })
})

gulp.task('watch', () => {
  $.watch(src.lib, gulp.series('build', 'test'))
  $.watch(test, gulp.series('test'))
})

gulp.task('build', gulp.series('clear', 'compile', 'minify'))

gulp.task('default', gulp.series('build', 'test', 'watch'))
