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
const TaskFatalError = require('ponos').TaskFatalError
const AccessDeniedError = require('models/access-denied-error')
const RateLimitedError = require('models/rate-limited-error')
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
      throw new TaskFatalError(
        'github.bot.notify',
        'Invalid job',
        { job: job, err: err })
    })
    .then(function connectToMongo () {
      return Promise.using(mongodbHelper(),
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
      log.info({ isolated: isolatedInstances }, 'isolated instances')
      const githubBot = new GitHubBot()
      return githubBot.notifyOnUpdateAsync(job.pushInfo, job.instance)
    })
    .catch(AccessDeniedError, function (err) {
      throw new TaskFatalError('github.bot.notify',
        'Runnabot has no access to an org',
        { err: err, job: job })
    })
    .catch(RateLimitedError, function (err) {
      throw new TaskFatalError('github.bot.notify',
        'Runnabot has reached rate-limit',
        { err: err, job: job })
    })
}
