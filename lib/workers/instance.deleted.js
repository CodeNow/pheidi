/**
 * Handle `instance.deleted` event.
 * Send notifications.
 * @module lib/workers/instance.deleted
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')
const keypather = require('keypather')()

const GitHubBot = require('notifications/github.bot')
const AccessDeniedError = require('models/access-denied-error')
const RateLimitedError = require('models/rate-limited-error')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports = InstanceDeleted

const schema = joi.object({
  instance: joi.object({
    owner: joi.object({
      github: joi.number().required()
    }).unknown().required(),
    contextVersions: joi.array().items(
      joi.object({
        appCodeVersions: joi.array().items(
          joi.object({
            repo: joi.string().required(),
            branch: joi.string().required()
          }).unknown().label('app code version')
        ).required()
      }).unknown().label('context version')
    ).required()
  }).unknown().required()
}).unknown().required().label('job')

/**
 * Flow:
 * 1. Find open PRs for instance
 * 2. Delete runnabot messages
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function InstanceDeleted (job) {
  const log = logger.child({
    module: 'InstanceDeleted',
    data: job
  })
  return Promise.try(function () {
    joi.assert(job, schema)
  }).catch(function (err) {
    throw new WorkerStopError('Invalid job', { err: err })
  })
    .then(function () {
      // only whitelisted orgs have runnabot github notifications
      if (process.env.PR_BOT_WHITELIST.includes(job.instance.owner.github)) {
        const cv = keypather.get(job, 'instance.contextVersions[0]') || {}
        const acv = cv.appCodeVersions.find(function (a) {
          return !a.additionalRepo
        })
        // if acv doesn't exist it's non-repo instance
        if (!acv) {
          return
        }
        const pushInfo = {
          repo: acv.repo,
          branch: acv.branch
        }
        const githubBot = new GitHubBot()
        if (job.instance.masterPod) {
          log.trace('delete all notifications')
          return githubBot.deleteAllNotificationsAsync(pushInfo)
        }
        log.trace('delete branch notifications')
        return githubBot.deleteBranchNotificationsAsync(pushInfo)
      }
    })
    .catch(AccessDeniedError, function (err) {
      throw new WorkerStopError('Runnabot has no access to an org', { err: err })
    })
    .catch(RateLimitedError, function (err) {
      throw new WorkerStopError('Runnabot has reached rate-limit', { err: err })
    })
}
