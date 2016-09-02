/**
 * Handle `organization.trial-ended` event.
 * Send notifications.
 * @module lib/workers/organization.trial-ended
 */
'use strict'

require('loadenv')()
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const OrganizationService = require('services/organization-service')
const log = require('logger').child({ module: 'organization.payment-method.added' })

const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = joi.object({
  organization: joi.object({
    id: joi.string().required(),
    name: joi.string().required()
  }).unknown().required(),
  tid: joi.string()
}).required().label('job')

/**
 * Notify that the trial has ended for an organization
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = function NotifyTrialEnded (job) {
  log.info({
    module: 'NotifyTrialEnded',
    job: job
  }, 'NotifyTrialEnded called')
  return OrganizationService.getAllUserEmailsForOrganization(job.organization.id)
    .then(function sendEmail (organizationUserEmails) {
      log.trace({ organizationUserEmails: organizationUserEmails }, 'Fetched all emails for organization')
      const sendGrid = new SendGrid()
      return sendGrid.trialEnded(job.organization.name, organizationUserEmails)
        .catch((err) => {
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
    .return()
}
