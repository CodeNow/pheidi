/**
 * Handle `organization.created` event.
 * Send welcome email.
 * @module lib/workers/organization.created
 */
'use strict'

require('loadenv')()
const joi = require('joi')

const SendGrid = require('models/sendgrid')
const logger = require('logger')

const WorkerStopError = require('error-cat/errors/worker-stop-error')
const mongoClient = require('mongo-helper').client

module.exports.jobSchema = joi.object({
  organization: joi.object({
    name: joi.string().required()
  }).unknown().required(),
  creator: joi.object({
    githubId: joi.number().required(),
    githubUsername: joi.string().required()
  }).unknown().required()
}).unknown().required().label('organization.created')

/**
 * Send welcome email to creator of newly created organization
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'SendWelcomeEmailForNewOrganization',
    job
  })
  return mongoClient.getUserEmailByGithubId(job.creator.githubId)
    .then((organizationCreatorEmail) => {
      if (!organizationCreatorEmail) {
        throw new WorkerStopError('Organization creator does not exist or does not have an email')
      }
      log.trace({ organizationCreatorEmail }, 'Got email for user')
      const sendGrid = new SendGrid()
      return sendGrid.welcomeEmailForOrganization(job.organization.name, organizationCreatorEmail, job.creator.githubUsername)
        .catch((err) => {
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
