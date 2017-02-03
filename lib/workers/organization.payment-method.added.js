/**
 * Handle `organization.payment-method.added` event.
 * Send notifications.
 * @module lib/workers/organization.payment-method.added
 */
'use strict'

require('loadenv')()

const SendGrid = require('models/sendgrid')
const mongoClient = require('mongo-helper').client
const log = require('logger').child({ module: 'organization.payment-method.added' })
const schemas = require('models/schemas')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = schemas.paymentMethodChange

/**
 * Notify a payment method owner that a payment method has been added
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  log.info({
    module: 'NotifyPaymentMethodAdded',
    job: job
  }, 'NotifyPaymentMethodAdded called')
  return mongoClient.getUserEmailByGithubId(job.paymentMethodOwner.githubId)
    .then((paymentMethodOwnerEmail) => {
      if (!paymentMethodOwnerEmail) {
        throw new WorkerStopError('Payment method owner does not exist or does not have an email')
      }
      log.trace({ paymentMethodOwnerEmail: paymentMethodOwnerEmail }, 'Got email for user')
      const sendGrid = new SendGrid()
      return sendGrid.paymentMethodAdded(job.organization.name, paymentMethodOwnerEmail)
        .catch((err) => {
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
