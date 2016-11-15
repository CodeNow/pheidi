/**
 * Handle `organization.user.added` event.
 * Send welcome email for a newly added user.
 * @module lib/workers/organization.user.added
 */
'use strict'

require('loadenv')()
const joi = require('joi')
const keypather = require('keypather')()

const SendGrid = require('models/sendgrid')
const logger = require('logger')
const bigPoppa = require('models/big-poppa')

const WorkerStopError = require('error-cat/errors/worker-stop-error')
const mongoClient = require('mongo-helper').client

module.exports.jobSchema = joi.object({
  organization: joi.object({
    id: joi.number().required()
  }).unknown().required(),
  user: joi.object({
    id: joi.number().required(),
    githubId: joi.number().required()
  }).unknown().required()
}).unknown().required()

/**
 * Send welcome email to newly added user
 *
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    method: 'SendWelcomeEmailToNewlyAddedUser',
    job
  })
  return bigPoppa.getOrganization(job.organization.id)
    .then(function getGithubIdsFor (org) {
      if (!org) {
        throw new WorkerStopError('Org did not exist in bigPoppa.', {}, { level: 'info' })
      }
      log.trace({ org }, 'Found organization')
      if (!org.isActive) {
        throw new WorkerStopError('Org has been disabled.', {}, { level: 'info' })
      }
      if (org.creator.id === job.user.id) {
        throw new WorkerStopError('This is the organization creator. Welcome email already sent', {}, { level: 'info' })
      }
      return [org, mongoClient.findOneUserAsync({
        'accounts.github.id': job.user.githubId
      })]
    })
    .spread((org, user) => {
      const username = keypather.get(user, 'accounts.github.username')
      const email = keypather.get(user, 'email')
      if (!username) {
        throw new WorkerStopError('User does not exist or does not have a username')
      }
      if (!email) {
        throw new WorkerStopError('User does not exist or does not have an email')
      }
      log.trace({ email, username }, 'Got username and email for user')
      const sendGrid = new SendGrid()
      return sendGrid.userAddedToOrganization(org.name, email, username)
        .catch((err) => {
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
