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
const schemas = require('models/schemas')

module.exports.jobSchema = schemas.instanceChange

/**
 * Flow:
 * 1. Find open PRs for instance
 * 2. Delete runnabot messages
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'InstanceDeleted',
    data: job
  })
  return Promise
    .try(() => {
      // do nothing for test instance
      if (job.instance.isTesting) {
        return
      }
      // only whitelisted orgs have runnabot github notifications
      if (process.env.PR_BOT_WHITELIST.includes(job.instance.owner.github)) {
        const cv = keypather.get(job, 'instance.contextVersion') || {}
        const acv = cv.appCodeVersions.find((a) => {
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
    .catch(AccessDeniedError, (err) => {
      throw new WorkerStopError('Runnabot has no access to an org', { err: err })
    })
    .catch(RateLimitedError, (err) => {
      throw new WorkerStopError('Runnabot has reached rate-limit', { err: err })
    })
}
