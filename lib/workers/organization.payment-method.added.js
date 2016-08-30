/**
 * Handle `organization.invoice.payment-failed` event.
 * Send notifications.
 * @module lib/workers/organization.invoice.payment-failed
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const mongodbHelper = require('mongo-helper')
const log = require('logger').child({ module: 'organization.payment-method.added'  })

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
 * Get a user by its github id
 *
 * @param {Number}             githubId - User's github id
 * @resolves {String}                   - User's email
 * @throws {WorkerStopError}            - If there is not user found or no email found
 * @returns {Promise}
 */
const getUserEmailByGithubId = (githubId) => {
  return Promise.using(mongodbHelper.helper(), (mongoClient) => {
    return mongoClient.findOneUserAsync({
      'accounts.github.id': githubId
    })
  })
    .then((user) => {
      if (!user) {
        throw new WorkerStopError('User did not exist on github', { userGithubId: githubId })
      }
      const paymentMethodOwnerEmail = user.email
      log.trace({ user: user, paymentMethodOwnerEmail: paymentMethodOwnerEmail }, 'Found user')
      if (!paymentMethodOwnerEmail) {
        throw new WorkerStopError('Payment method owner does not have an email', { user: user })
      }
      return paymentMethodOwnerEmail
    })
}

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
  return getUserEmailByGithubId(job.paymentMethodOwner.githubId)
    .then((paymentMethodOwnerEmail) => {
      log.trace({ paymentMethodOwnerEmail: paymentMethodOwnerEmail }, 'Got email for user')
      var sendGrid = new SendGrid()
      return sendGrid.paymentMethodAdded(job.organization.name, paymentMethodOwnerEmail)
        .catch((err) => {
          log.error({ err: err }, 'Failed to send email')
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}

module.exports.getUserEmailByGithubId = getUserEmailByGithubId
