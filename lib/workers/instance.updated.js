/**
 * Handle `instance.updated` event.
 * Send notifications.
 * @module lib/workers/instance.updated
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')
const keypather = require('keypather')()

const GitHubBot = require('notifications/github.bot')
const TaskFatalError = require('ponos').TaskFatalError
const logger = require('logger')

module.exports = InstanceUpdated

const schema = joi.object({
  instance: joi.object({
    owner: joi.object({
      github: joi.number().required()
    }).unknown().required(),
    contextVersions: joi.array().items(
      joi.object().unknown().label('context version')).required()
  }).unknown().required()
}).unknown().required().label('job')

/**
 * Flow:
 * 1. Calculate instance state: `failed`, `stopped`, `building`, `running`
 * 2. send github PR bot message
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
        const container = keypather.get(job, 'instance.containers[0]') || {}
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
          branch: acv.branch,
          state: instanceState(cv, container)
        }
        // do nothing if state is not defined
        if (!pushInfo.state) {
          log.error('instance state is not defined')
          return
        }
        return Promise.fromCallback(function (cb) {
          githubBot.notifyOnUpdate(pushInfo, job.instance, function (err) {
            if (err) {
              log.error({ err: err }, 'github bot build notification error')
              return cb(err)
            }
            log.info('github bot build notification success')
            cb()
          })
        })
      }
    })
}

/**
 * Find instance state based on the instance CV and attached container
 * @param {Object} cv contextVersion data
 * @param {Object} container container data
 * @return {String} state of the instance: failed, stopped, running, building or null
 */
function instanceState (cv, container) {
  const build = cv.build
  if (build.failed) {
    return 'failed'
  }
  if (build.completed) {
    const continerStatus = keypather.get(container, 'inspect.State.Status')
    if (container && continerStatus === 'exited') {
      return 'stopped'
    }
    return 'running'
  }
  if (cv.state === 'build_started') {
    return 'building'
  }
  return null
}

module.exports._instanceState = instanceState
