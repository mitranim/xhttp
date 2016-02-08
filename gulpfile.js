'use strict'

/** **************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const del = require('del')
const gulp = require('gulp')
const exec = require('child_process').exec

/** ******************************* Globals **********************************/

const src = {
  lib: 'lib/**/*.js',
  dist: 'dist/**/*.js'
}

const out = 'dist'

const test = 'test/**/*.js'

const testCommand = require('./package').scripts.test

function noop () {}

/** ******************************** Tasks ***********************************/

gulp.task('clear', () => (
  del(out).catch(noop)
))

gulp.task('compile', () => (
  gulp.src(src.lib)
    .pipe($.babel())
    .pipe(gulp.dest(out))
))

gulp.task('minify', () => (
  gulp.src(src.dist)
    .pipe($.uglify({mangle: true, compress: {warnings: false}}))
    .pipe($.rename(path => {
      path.extname = '.min.js'
    }))
    .pipe(gulp.dest(out))
))

gulp.task('test', done => {
  exec(testCommand, (err, stdout) => {
    process.stdout.write(stdout)
    done(err)
  })
})

gulp.task('watch', () => {
  $.watch(src.lib, gulp.parallel('test', 'build'))
  $.watch(test, gulp.series('test'))
})

gulp.task('build', gulp.series('clear', 'compile', 'minify'))

gulp.task('default', gulp.series('test', 'build', 'watch'))
