/**
 * Handle `organization.trial.ended` event.
 * Send notifications.
 * @module lib/workers/organization.trial.ended
 */
'use strict'

require('loadenv')()

const SendGrid = require('models/sendgrid')
const OrganizationService = require('services/organization-service')
const log = require('logger').child({ module: 'organization.trial.ended' })

const WorkerStopError = require('error-cat/errors/worker-stop-error')

const schemas = require('models/schemas')

module.exports.jobSchema = schemas.trialEvent

/**
 * Notify that the trial has ended for an organization
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
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
