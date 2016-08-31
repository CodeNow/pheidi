'use strict'

const Promise = require('bluebird')
const keypather = require('keypather')()

const log = require('logger').child({ module: 'mongo-helper' })
const MongoDB = require('models/mongo')

module.exports = class MongoHelper {

  /**
   * MongoDB Promise.using helper.
   * @return {promise} Resolved when the MongoDB client is created.
   */
  static helper () {
    const mongodbClient = new MongoDB()
    return mongodbClient.connectAsync()
      .then(function () { return mongodbClient })
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
  static getUserEmailByGithubId (githubId) {
    return Promise.using(MongoHelper.helper(), (mongoClient) => {
      return mongoClient.findOneUserAsync({
        'accounts.github.id': githubId
      })
    })
    .then((user) => {
      return keypather.get(user, 'email')
    })
  }
}
