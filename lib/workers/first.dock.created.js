/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/first.dock.created
 */
'use strict'

require('loadenv')()

const joi = require('joi')
const keypather = require('keypather')()
const logger = require('logger')

const mongoClient = require('mongo-helper').client
const SendGrid = require('models/sendgrid')
const bigPoppa = require('models/big-poppa')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = joi.object({
  githubId: joi.alternatives().try(joi.number(), joi.string()).required(),
  tid: joi.string()
}).required().label('job')

/**
 * Send email to organization creator when first dock is created
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'FirstDockCreated',
    data: job
  })
  return bigPoppa.getOrganizations({ githubId: job.githubId })
    .get(0)
    .then((org) => {
      if (!org) {
        throw new WorkerStopError('Org did not exist in bigPoppa.', {}, { level: 'info' })
      }
      return [ org.name, mongoClient.findOneUserAsync({
        'accounts.github.id': org.creator.githubId
      })]
    })
    .spread((orgName, orgCreator) => {
      const email = keypather.get(orgCreator, 'email')
      var sendGrid = new SendGrid()
      return sendGrid.dockCreated({ login: orgName, email: email })
        .catch((err) => {
          log.error({ err: err }, 'Failed to send email')
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
