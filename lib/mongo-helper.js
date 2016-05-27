'use strict'

const Promise = require('bluebird')
const log = require('logger').child({ module: 'mongo-helper' })
const MongoDB = require('models/mongo')

/**
 * MongoDB Promise.using helper.
 * @return {promise} Resolved when the MongoDB client is created.
 */
module.exports.helper = function () {
  return Promise.resolve()
    .then(function newConnection () {
      const mongodbClient = new MongoDB()
      return mongodbClient.connectAsync()
        .then(function () { return mongodbClient })
    })
    .disposer(function destroyConnection (mongodbClient) {
      return mongodbClient.closeAsync()
        .catch(function (err) {
          log.error({ err: err }, 'mongodb cannot close')
          return true
        })
    })
}
