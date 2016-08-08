
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

const rabbitmq = require('rabbitmq')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports = InstanceUpdated

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
  }).unknown().required(),
  tid: joi.string()
}).unknown().required().label('job')

/**
 * Flow:
 * 1. Calculate instance state: `failed`, `stopped`, `building`, `running`
 * 2. Publish `github.bot.notify` command
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function InstanceUpdated (job) {
  const log = logger.child({
    module: 'InstanceUpdated',
    data: job
  })
  return Promise.try(function () {
    joi.assert(job, schema)
  }).catch(function (err) {
    throw new WorkerStopError('Invalid job', { err: err })
  })
    .then(function () {
      // only whitelisted orgs will receive runnabot github notifications for now
      if (process.env.PR_BOT_WHITELIST.includes(job.instance.owner.github)) {
        const container = keypather.get(job, 'instance.containers[0]') || {}
        const cv = keypather.get(job, 'instance.contextVersions[0]') || {}
        const acv = cv.appCodeVersions.find(function (a) {
          return !a.additionalRepo
        })
        // if acv doesn't exist it's non-repo instance
        if (!acv) {
          log.info('did not find main repo acv')
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
        rabbitmq.publishGitHubBotNotify({ pushInfo: pushInfo, instance: job.instance })
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
