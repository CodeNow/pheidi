/**
 * Handle `organization.payment-method.removed` event.
 * Send notifications.
 * @module lib/workers/organization.payment-method.removed
 */
'use strict'

require('loadenv')()

const SendGrid = require('models/sendgrid')
const logger = require('logger')
const mongoClient = require('mongo-helper').client
const schemas = require('models/schemas')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = schemas.paymentMethodChange

/**
 * Notify a payment method owner that a payment method has been removed
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'NotifyPaymentMethodRemoved',
    job: job
  })
  return mongoClient.getUserEmailByGithubId(job.paymentMethodOwner.githubId)
    .then((paymentMethodOwnerEmail) => {
      if (!paymentMethodOwnerEmail) {
        throw new WorkerStopError('Payment method owner does not exist or does not have an email')
      }
      log.trace({ paymentMethodOwnerEmail: paymentMethodOwnerEmail }, 'Got email for user')
      const sendGrid = new SendGrid()
      return sendGrid.paymentMethodRemoved(job.organization.name, paymentMethodOwnerEmail)
        .catch((err) => {
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
