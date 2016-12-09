
/**
 * Handle `instance.updated` event.
 * Send notifications.
 * @module lib/workers/instance.updated
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const utils = require('models/utils')
const rabbitmq = require('rabbitmq')
const logger = require('logger')
const schemas = require('models/schemas')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = schemas.instanceChange

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
      if (!utils.shouldInstanceBeNotified(job.instance)) {
        throw new WorkerStopError('Instance does not need to be notified')
      }
      const pushInfo = utils.getPushInfoForInstance(job.instance)
      // do nothing if state is not defined
      if (!pushInfo) {
        log.error('instance state is not defined')
        throw new WorkerStopError('Instance does not need to be notified because it has no stated')
      }
      rabbitmq.publishGitHubBotNotify({ pushInfo, instance: job.instance })
    })
}
