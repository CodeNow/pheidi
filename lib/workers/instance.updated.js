
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

const utils = require('models/utils')
const rabbitmq = require('rabbitmq')
const logger = require('logger')

module.exports.jobSchema = joi.object({
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
module.exports.task = (job) => {
  const log = logger.child({
    module: 'InstanceUpdated',
    data: job
  })
  return Promise
    .try(() => {
      // do nothing for test instance
      if (job.instance.isTesting) {
        return
      }
      // only whitelisted orgs will receive runnabot github notifications for now
      if (process.env.PR_BOT_WHITELIST.includes(job.instance.owner.github)) {
        const cv = keypather.get(job, 'instance.contextVersions[0]') || {}
        const acv = cv.appCodeVersions.find((a) => {
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
          state: utils.instanceState(job.instance)
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
