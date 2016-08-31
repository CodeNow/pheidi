'use strict'

const Promise = require('bluebird')
const keypather = require('keypather')()

const log = require('logger').child({ module: 'mongo-helper' })
const MongoDB = require('models/mongo')

class MongoHelper {

  constructor () {
    this.mongodbClient = new MongoDB()
  }

  /**
   * Connect to Mongo
   *
   * @resolves {Object} - Mongo client instance
   * @returns {Promise}
   */
  connect () {
    return this.mongodbClient.connectAsync()
      .return(this.mongodbClient)
  }

  /**
   * Disconnect from Mongo
   *
   * @resolves {undefined}
   * @returns {Promise}
   */
  disconnect () {
    return this.mongodbClient.closeAsyn()
  }

  /**
   * MongoDB Promise.using helper.
   * @return {promise} Resolved when the MongoDB client is created.
   */
  static helper () {
    return Promise.try(() => {
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

  /**
   * Get a user by its github id
   *
   * @param {Number}             githubId - User's github id
   * @resolves {String}                   - User's email
   * @throws {WorkerStopError}            - If there is not user found or no email found
   * @returns {Promise}
   */
  getUserEmailByGithubId (githubId) {
    return this.mongodbClient.findOneUserAsync({
      'accounts.github.id': githubId
    })
      .then((user) => {
        return keypather.get(user, 'email')
      })
  }
}

module.exports = MongoHelper
module.exports.client = new MongoHelper()
