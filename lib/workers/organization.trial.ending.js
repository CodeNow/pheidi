/**
 * Handle `organization.trial.ending` event.
 * Send notifications.
 * @module lib/workers/organization.trial.ending
 */
'use strict'

require('loadenv')()
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const OrganizationService = require('services/organization-service')
const logger = require('logger').child({ module: 'organization.trial.ending' })

const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = joi.object({
  organization: joi.object({
    id: joi.number().required(),
    name: joi.string().required()
  }).unknown().required()
}).unknown().required()

/**
 * Notify that the trial is ending for an organization
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({ module: 'NotifyTrialEnding', job: job })
  log.info('NotifyTrialEnding called')
  return OrganizationService.getAllUserEmailsForOrganization(job.organization.id)
    .then(function sendEmail (organizationUserEmails) {
      log.trace({ organizationUserEmails: organizationUserEmails }, 'Fetched all emails for organization')
      if (Array.isArray(organizationUserEmails) && organizationUserEmails.length === 0) {
        throw new WorkerStopError('No email addresses found for organization')
      }
      const sendGrid = new SendGrid()
      return sendGrid.trialEnding(job.organization.name, organizationUserEmails)
        .catch((err) => {
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
    .return()
}
