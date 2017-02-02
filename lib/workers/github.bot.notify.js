/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/github.bot.notify
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const mongoClient = require('mongo-helper').client
const ObjectID = require('mongodb').ObjectID
const GitHubBot = require('notifications/github.bot')
const AccessDeniedError = require('models/access-denied-error')
const InvalidStatusError = require('models/invalid-status-error')
const RateLimitedError = require('models/rate-limited-error')
const schemas = require('models/schemas')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports.jobSchema = schemas.githubBotNotify

/**
 * Send github PR bot message
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'GitHubBotNotify',
    data: job
  })
  return Promise
    .try(() => {
      const instance = job.instance
      if (instance.isIsolationGroupMaster) {
        const query = {
          isIsolationGroupMaster: false,
          isolated: new ObjectID(instance.isolated)
        }
        log.info(query, 'query isolated instances')
        return mongoClient.findInstancesAsync(query)
      }
      return []
    })
    .then((isolatedInstances) => {
      isolatedInstances = isolatedInstances || []
      log.info({ isolatedInstances: isolatedInstances }, 'isolated instances')
      const githubBot = new GitHubBot()
      return githubBot.notifyOnUpdateAsync(job.pushInfo, job.instance, isolatedInstances)
    })
    .catch(AccessDeniedError, (err) => {
      throw new WorkerStopError('Runnabot has no access to an org', { err: err }, { level: 'info' })
    })
    .catch(RateLimitedError, (err) => {
      throw new WorkerStopError('Runnabot has reached rate-limit', { err: err })
    })
    .catch(InvalidStatusError, (err) => {
      throw new WorkerStopError('Github shouldn\'t have been notified', { err: err }, { level: 'info' })
    })
}
