/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/first.dock.created
 */
'use strict'

require('loadenv')()

const joi = require('joi')

const Github = require('models/github')
const Intercom = require('models/intercom')
const FatalGithubError = require('notifications/github.status').FatalGithubError
const SendGrid = require('models/sendgrid')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports.jobSchema = joi.object({
  githubId: joi.alternatives().try(joi.number(), joi.string()).required(),
  tid: joi.string()
}).required().label('job')

/**
 * Send github PR bot message
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'FirstDockCreated',
    data: job
  })
  var github = new Github({
    token: process.env.EMAIL_GITHUB_ACCESS_TOKEN
  })
  return github.getUserByIdAsync(parseInt(job.githubId, 10))
    .tap((org) => {
      if (!org) {
        throw new FatalGithubError('Org did not exist on github')
      }
    })
    .then((org) => {
      var intercom = new Intercom({
        appId: process.env.INTERCOM_APP_ID,
        apiKey: process.env.INTERCOM_API_KEY
      })
      return intercom.getEmailFromOrgName(org.login)
        .then((email) => {
          org.email = email
          return org
        })
    })
    .then((org, login) => {
      var sendGrid = new SendGrid()
      return sendGrid.dockCreated(org)
        .catch((err) => {
          log.error({ err: err }, 'Failed to send email')
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
