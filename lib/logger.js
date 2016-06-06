'use strict'

require('loadenv')()

const bunyan = require('bunyan')
const defaults = require('101/defaults')
const pick = require('101/pick')

/**
 * Serializers for pheidi logging.
 * @type {Object}
 */
const serializers = {
  instance: function (instance) {
    return pick(instance, ['_id', 'name', 'owner', 'contextVersions'])
  }
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
