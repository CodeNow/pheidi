/**
 * Handle `organization.invoice.payment-failed` event.
 * Send notifications.
 * @module lib/workers/organization.invoice.payment-failed
 */
'use strict'

require('loadenv')()
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const logger = require('logger')

const WorkerStopError = require('error-cat/errors/worker-stop-error')
const getUserEmailByGithubId = require('./organization.payment-method.added')

module.exports.jobSchema = joi.object({
  organization: joi.object({
    name: joi.string().required()
  }).unknown().required(),
  paymentMethodOwner: joi.object({
    githubId: joi.number().required()
  }).unknown().required(),
  tid: joi.string()
}).required().label('job')

/**
 * Notify a payment method owner that a payment method has been removed
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = function NotifyPaymentMethodRemoved (job) {
  const log = logger.child({
    module: 'NotifyPaymentMethodRemoved',
    job: job
  })
  return getUserEmailByGithubId(job.paymentMethodOwner.githubId)
    .then((paymentMethodOwnerEmail) => {
      var sendGrid = new SendGrid()
      return sendGrid.paymentMethodRemoved(job.organization.name, paymentMethodOwnerEmail)
        .catch((err) => {
          log.error({ err: err }, 'Failed to send email')
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
