/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/github.bot.notify
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')

const GitHubBot = require('notifications/github.bot')
const TaskFatalError = require('ponos').TaskFatalError
const AccessDeniedError = require('models/access-denied-error')
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
        { job: job, err: err }
      )
    })
    .then(function () {
      const githubBot = new GitHubBot()
      return Promise.fromCallback(function (cb) {
        githubBot.notifyOnUpdate(job.pushInfo, job.instance, function (err) {
          if (err) {
            log.error({ err: err }, 'github bot build notification error')
            if (err instanceof AccessDeniedError) {
              return cb(new TaskFatalError('github.bot.notify',
                'Runnabot has no access to an org',
                { err: err, job: job }))
            }
            return cb(err)
          }
          log.info('github bot build notification success')
          cb()
        })
      })
    })
}
