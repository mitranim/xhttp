'use strict'

/** **************************** Dependencies ********************************/

const $ = require('gulp-load-plugins')()
const del = require('del')
const gulp = require('gulp')
const {spawn} = require('child_process')

/** ******************************* Globals **********************************/

const _srcDir = 'src'
const _libDir = 'lib'
const esDir = 'es'
const distDir = 'dist'
const srcFiles = 'src/**/*.js'
const libFiles = 'lib/**/*.js'
const esFiles = 'es/**/*.js'
const distFiles = 'dist/**/*.js'
const testFiles = 'test/**/*.js'

const [testExecutable, ...testArgs] = require('./package').scripts.test.split(/\s/g)

function noop () {}

const GulpErr = msg => ({showStack: false, toString: () => msg})

/** ******************************** Tasks ***********************************/

gulp.task('clear', () => (
  del([distFiles, esFiles]).catch(noop)
))

gulp.task('compile', () => (
  gulp.src(srcFiles)
    .pipe($.babel())
    .pipe(gulp.dest(esDir))
    .pipe($.babel({
      plugins: [
        'transform-es2015-modules-commonjs',
      ],
    }))
    .pipe(gulp.dest(distDir))
    // Ensures ES5 compliance and lets us measure minified size
    .pipe($.uglify({
      mangle: {toplevel: true},
      compress: {warnings: false},
    }))
    .pipe(new Transform({
      objectMode: true,
      transform(file, __, done) {
        log(`Minified size: ${file._contents.length} bytes`)
        done()
      },
    }))
))

let testProc = null

gulp.task('test', done => {
  // Still running, let it finish
  if (testProc && testProc.exitCode == null) {
    done()
    return
  }

  testProc = spawn(testExecutable, testArgs)
  testProc.stdout.pipe(process.stdout)
  testProc.stderr.pipe(process.stderr)

  testProc.once('error', err => {
    testProc.kill()
    done(err)
  })

  testProc.once('exit', code => {
    done(code ? GulpErr(`Test failed with exit code ${code}`) : null)
  })
})

gulp.task('watch', () => {
  $.watch(srcFiles, gulp.series('build', 'test'))
  $.watch([libFiles, testFiles], gulp.series('test'))
})

gulp.task('build', gulp.series('clear', 'compile'))

gulp.task('default', gulp.series('build', 'test', 'watch'))
