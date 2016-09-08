'use strict'

const BaseError = require('error-cat/errors/base-error')
const monitor = require('monitor-dog')

/**
 * Github rate limit error
 * @param  {[type]} message Message for the error.
 * @param  {[type]} data    Custom data to report to rollbar.
 * @module rate-limited-error:error
 */
module.exports = class RateLimitedError extends BaseError {
  constructor (message, data) {
    super('RateLimitedError: ' + message, data)
    monitor.increment('github.rate.limited')
    this.setLevel('warn')
  }
}
