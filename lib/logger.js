'use strict'

require('loadenv')()

const bunyan = require('bunyan')
const clone = require('101/clone')
const defaults = require('101/defaults')

/**
 * Serializers for pheidi logging.
 * @type {Object}
 */
var serializers = {
}
defaults(serializers, bunyan.stdSerializers)

/**
 * The default logger for pheidi.
 * @type {bunyan}
 */
module.exports = bunyan.createLogger({
  name: process.env.APP_NAME,
  streams: [{ level: process.env.LOG_LEVEL, stream: process.stdout }],
  serializers: serializers
})
