'use strict'

const BaseError = require('error-cat/errors/base-error')

/**
 * Invalid Status Error
 * @param  {[type]} message Message for the error.
 * @param  {[type]} data    Custom data to report to rollbar.
 */
module.exports = class InvalidStatusError extends BaseError {
  constructor (message, data) {
    super('Invalid Status Error: ' + message, data)
    this.setLevel('warn')
  }
}
