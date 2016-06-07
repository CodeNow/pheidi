/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/github.bot.notify
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')

const mongodbHelper = require('mongo-helper')
const ObjectID = require('mongodb').ObjectID
const GitHubBot = require('notifications/github.bot')
const AccessDeniedError = require('models/access-denied-error')
const RateLimitedError = require('models/rate-limited-error')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports = GitHubBotNotify

const schema = joi.object({
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
  }).unknown().required()
}).unknown().required().label('job')

/**
 * Send github PR bot message
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function GitHubBotNotify (job) {
  const log = logger.child({
    module: 'GitHubBotNotify',
    data: job
  })
  return Promise.try(
    function validateArguments () {
      joi.assert(job, schema)
    }).catch(function (err) {
      throw new WorkerStopError('Invalid job', { err: err })
    })
    .then(function connectToMongo () {
      return Promise.using(mongodbHelper.helper(),
        function (mongoClient) {
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
    })
    .then(function (isolatedInstances) {
      isolatedInstances = isolatedInstances || []
      log.info({ isolatedInstances: isolatedInstances.length }, 'isolated instances')
      const githubBot = new GitHubBot()
      return githubBot.notifyOnUpdateAsync(job.pushInfo, job.instance, isolatedInstances)
    })
    .catch(AccessDeniedError, function (err) {
      throw new WorkerStopError('Runnabot has no access to an org', { err: err })
    })
    .catch(RateLimitedError, function (err) {
      throw new WorkerStopError('Runnabot has reached rate-limit', { err: err })
    })
}
