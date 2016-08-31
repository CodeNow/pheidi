/**
 * Handle `organization.payment-method.added` event.
 * Send notifications.
 * @module lib/workers/organization.payment-method.added
 */
'use strict'

require('loadenv')()
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const mongoHelper = require('mongo-helper')
const log = require('logger').child({ module: 'organization.payment-method.added' })

const WorkerStopError = require('error-cat/errors/worker-stop-error')

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
 * Notify a payment method owner that a payment method has been added
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = function NotifyPaymentMethodAdded (job) {
  log.info({
    module: 'NotifyPaymentMethodAdded',
    job: job
  }, 'NotifyPaymentMethodAdded called')
  return mongoHelper.getUserEmailByGithubId(job.paymentMethodOwner.githubId)
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
