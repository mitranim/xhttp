import {AssertionError} from 'assert'
import * as f from 'fpx'
import * as e from 'emerge'

export function is(actual, expected, message) {
  if (!e.is(actual, expected)) {
    throw new AssertionError({actual, expected, operator: `is`, stackStartFunction: is, message})
  }
}

export function eq(actual, expected, message) {
  if (!e.equal(actual, expected)) {
    throw new AssertionError({actual, expected, operator: `eq`, stackStartFunction: eq, message})
  }
}

export function throws(fun, messageOrClass) {
  if (!f.isFunction(fun)) {
    throw new AssertionError({message: `expected a function, got ${f.show(fun)}`})
  }
  if (!messageOrClass) {
    throw new AssertionError({
      message: `expected an error message or class, got ${f.show(messageOrClass)}`,
    })
  }
  try {
    fun()
  }
  catch (err) {
    if (f.isFunction(messageOrClass)) {
      if (!(err instanceof messageOrClass)) {
        throw new AssertionError({
          message: `expected ${f.show(fun)} to throw an instance of ${f.show(messageOrClass)}, got ${f.show(err)}`,
          stackStartFunction: throws,
        })
      }
    }
    else if (!err || !(err instanceof Error) || !err.message.match(messageOrClass)) {
      throw new AssertionError({
        message: (
          `expected ${f.show(fun)} to throw an error with a message matching ` +
          `${f.show(messageOrClass)}, got ${f.show(err)}`
        ),
        stackStartFunction: throws,
      })
    }
    return
  }
  throw new AssertionError({
    message: `expected ${f.show(fun)} to throw`,
    stackStartFunction: throws,
  })
}

export function eqDicts(actual, expected) {
  f.validate(actual, f.isDict)
  f.validate(expected, f.isDict)

  eq(f.keys(actual).sort(), f.keys(expected).sort())

  for (const key of f.keys(expected)) {
    eq(actual[key], expected[key], `expecting match at key ${f.show(key)}`)
  }
}

export function runWithTimeout(fun) {
  const timer = setTimeout(timeoutPanic, 2048)
  return fun().then(clearTimeout.bind(undefined, timer), panic)
}

function timeoutPanic() {
  panic(Error(`test timeout`))
}

export function panic(err) {
  console.error(`fatal error:`, err)
  process.exit(1)
}

export async function resErr(promise) {
  let res
  try {
    res = await promise
  }
  catch (err) {
    return err
  }
  throw Error(`expected request to fail, got response ${f.show(res)}`)
}
