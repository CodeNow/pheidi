'use strict'

require('loadenv')()

const bunyan = require('bunyan')
const defaults = require('101/defaults')
const getNamespace = require('continuation-local-storage').getNamespace
const pick = require('101/pick')
const stack = require('callsite')

/**
 * Serializers for pheidi logging.
 * @type {Object}
 */
const serializers = {
  tx: function () {
    var out
    try {
      out = {
        tid: getNamespace('ponos').get('tid')
      }
    } catch (e) {
      // cant do anything here
    }
    return out
  },
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
  serializers: serializers,
  src: false
}).child({ tx: true, module: stack()[1].getFileName() })
