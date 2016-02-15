'use strict'

/** **************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const del = require('del')
const gulp = require('gulp')
const exec = require('child_process').exec

/** ******************************* Globals **********************************/

const src = {
  lib: 'lib/**/*.js',
  main: 'dist/**/*.js',
  next: 'dist-jsnext/**/*.js'
}

const out = {
  main: 'dist',
  next: 'dist-jsnext'
}

const test = 'test/**/*.js'

const testCommand = require('./package').scripts.test

function noop () {}

const configNext = {
  plugins: [
    'check-es2015-constants',
    'transform-es2015-arrow-functions',
    'transform-es2015-block-scoped-functions',
    'transform-es2015-block-scoping',
    'transform-es2015-literals',
    'transform-es2015-template-literals'
  ]
}

const configMain = {
  plugins: configNext.plugins.concat('transform-es2015-modules-commonjs')
}

/** ******************************** Tasks ***********************************/

gulp.task('clear', () => (
  del([out.main, out.next]).catch(noop)
))

gulp.task('compile:main', () => (
  gulp.src(src.lib)
    .pipe($.babel(configMain))
    .pipe(gulp.dest(out.main))
))

gulp.task('compile:next', () => (
  gulp.src(src.lib)
    .pipe($.babel(configNext))
    .pipe(gulp.dest(out.next))
))

gulp.task('compile', gulp.parallel('compile:main', 'compile:next'))

gulp.task('minify', () => (
  gulp.src(src.main)
    .pipe($.uglify({mangle: true, compress: {warnings: false}}))
    .pipe($.rename(path => {
      path.extname = '.min.js'
    }))
    .pipe(gulp.dest(out.main))
))

gulp.task('test', done => {
  exec(testCommand, (err, stdout) => {
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
