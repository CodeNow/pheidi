/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/github.bot.notify
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')

const mongoClient = require('mongo-helper').client
const ObjectID = require('mongodb').ObjectID
const GitHubBot = require('notifications/github.bot')
const AccessDeniedError = require('models/access-denied-error')
const RateLimitedError = require('models/rate-limited-error')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports.jobSchema = joi.object({
  pushInfo: joi.object({
    repo: joi.string().required(),
    branch: joi.string().required(),
    state: joi.string().required()
  }).required(),
  instance: joi.object({
    owner: joi.object({
      github: joi.number().required()
    }).unknown().required(),
    contextVersions: joi.array().items(
      joi.object().unknown().label('context version')).required()
  }).unknown().required(),
  tid: joi.string()
}).unknown().required().label('job')

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
}
