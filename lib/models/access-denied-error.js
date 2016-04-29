'use strict'

const BaseError = require('error-cat/errors/base-error')
const monitor = require('monitor-dog')

/**
 * Github access denied error
 * @param  {[type]} message Message for the error.
 * @param  {[type]} data    Custom data to report to rollbar.
 */
class AccessDeniedError extends BaseError {
  constructor (message, data) {
    super('AccessDeniedError: ' + message, data)
    monitor.increment('github.access.denied')
    this.setLevel('warn')
  }
}

/**
 * Monitored Error Class
 * @module access-denied-error:error
 */
module.exports = AccessDeniedError
