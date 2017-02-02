'use strict'

const BaseError = require('error-cat/errors/base-error')

/**
 * PR access denied error (user has not allowed prbot)
 * @param  {[type]} message Message for the error.
 * @param  {[type]} data    Custom data to report to rollbar.
 */
module.exports = class PrAccessDeniedError extends BaseError {
  constructor (message, data) {
    super('PrAccessDeniedError: ' + message, data)
    this.setLevel('warn')
  }
}
