/**
 * Handle `instance.updated` event.
 * Send notifications.
 * @module lib/workers/instance.updated
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const ObjectID = require('mongodb').ObjectID
const joi = require('joi')
const mongodbHelper = require('mongo-helper')

const GitHubBot = require('notifications/github.bot')
const GitHubDeploy = require('notifications/github.deploy')
const Slack = require('notifications/slack')
const TaskFatalError = require('ponos').TaskFatalError
const logger = require('logger')

module.exports = InstanceUpdated

const schema = joi.object({
  instance: joi.object().unknown().required(),
  timestamp: joi.number().required()
}).required().label('job')


// contextVersion[0].build.state = "build_started"
// contextVersion[0].build.failed": true, - failed
// contextVersion[0].build.failed": false, - failed and contextVersion[0].build.completed"
/**
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function InstanceUpdated (job) {
  const log = logger.child({
    module: 'InstanceUpdated',
    data: job
  })
  log.info('call')
  return Promise.resolve()
    .then(function validateArguments () {
      return Promise.try(function () {
        joi.assert(job, schema)
      }).catch(function (err) {
        throw new TaskFatalError(
          'instance.updated',
          'Invalid job',
          { job: job, err: err }
        )
      })
    })
    .then(function () {
      // only whitelisted orgs will receive runnabout github notifications for now
      if (process.env.PR_BOT_WHITELIST.indexOf(job.instance.owner.github) > -1) {
        const githubBot = new GitHubBot()
        const cv = instance.contextVersions[0] || {}
        const acv = find(cv.appCodeVersions, function (a) {
          return !a.additionalRepo
        })
        const pushInfo = {
          repo: acv.repo,
          branch: acv.branch,
          type: 'failed'
        }
        githubBot.notifyOnUpdate(pushInfo, job.instance, function (err) {
          if (err) {
            log.error({ err: err }, 'github bot build notification error')
          } else {
            log.info('github bot build notification success')
          }
        })
      }
    })
}
