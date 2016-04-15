/**
 * Handle `instance.updated` event.
 * Send notifications.
 * @module lib/workers/instance.updated
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')

const GitHubBot = require('notifications/github.bot')
const TaskFatalError = require('ponos').TaskFatalError
const logger = require('logger')

module.exports = InstanceUpdated

const schema = joi.object({
  instance: joi.object().unknown().required(),
  timestamp: joi.number().required()
}).required().label('job')

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
        const cv = job.instance.contextVersions[0] || {}
        const acv = cv.appCodeVersions.find(function (a) {
          return !a.additionalRepo
        })
        // if acv doesn't exist it's non-repo instance
        if (acv) {
          const pushInfo = {
            repo: acv.repo,
            branch: acv.branch,
            state: instanceState(cv)
          }
          // do nothing if state is not defined
          if (pushInfo.state) {
            githubBot.notifyOnUpdate(pushInfo, job.instance, function (err) {
              if (err) {
                log.error({ err: err }, 'github bot build notification error')
              } else {
                log.info('github bot build notification success')
              }
            })
          }
        }
      }
    })
}

function instanceState (cv) {
  var build = cv.build
  if (build.failed) {
    return 'failed'
  }
  if (build.completed) {
    return 'running'
  }
  if (cv.state === 'build_started') {
    return 'building'
  }
  return null
}

module.exports._instanceState = instanceState
