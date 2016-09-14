/**
 * Handle `organization.invoice.payment-failure` event.
 * Send notifications.
 * @module lib/workers/organization.invoice.payment-failure
 */
'use strict'

require('loadenv')()
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const mongoClient = require('mongo-helper').client
const log = require('logger').child({ module: 'organization.invoice.payment-failure' })
const OrganizationService = require('services/organization-service')

const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = joi.object({
  invoicePaymentHasFailedFor24Hours: joi.boolean().required(),
  organization: joi.object({
    id: joi.number().required(),
    name: joi.string().required()
  }).unknown().required(),
  paymentMethodOwner: joi.object({
    githubId: joi.number().required()
  }).unknown().required(),
  tid: joi.string()
}).required().label('job')

const emailErrorHandler = (err) => {
  throw new WorkerStopError('Failed to send email', { err: err })
}

/**
 * Notify a payment method owner or all members of the organization that the
 * payment of an invoice has failed
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  log.info({
    module: 'NotifyInvoicePaymentFailure',
    job: job
  }, 'NotifyInvoicePaymentFailure called')
  const sendGrid = new SendGrid()
  if (!job.invoicePaymentHasFailedFor24Hours) { // First notification
    return mongoClient.getUserEmailByGithubId(job.paymentMethodOwner.githubId)
    .then((paymentMethodOwnerEmail) => {
      if (!paymentMethodOwnerEmail) {
        throw new WorkerStopError('Payment method owner does not exist or does not have an email')
      }
      log.trace({ paymentMethodOwnerEmail }, 'Got email for user')
      return sendGrid.billingErrorToAdmin(job.organization.name, paymentMethodOwnerEmail)
        .catch(emailErrorHandler)
    })
  }
  // Second notification after 24 hours
  return OrganizationService.getAllUserEmailsForOrganization(job.organization.id)
  .then(function sendEmail (organizationUserEmails) {
    log.trace({ organizationUserEmails }, 'Fetched all emails for organization')
    if (Array.isArray(organizationUserEmails) && organizationUserEmails.length === 0) {
      throw new WorkerStopError('No email addresses found for organization')
    }
    return sendGrid.billingErrorToAllMembers(job.organization.name, organizationUserEmails)
      .catch(emailErrorHandler)
  })
}
