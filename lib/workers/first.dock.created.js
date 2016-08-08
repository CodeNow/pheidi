/**
 * Handle `github.bot.notify` command.
 * Send github bot notification.
 * @module lib/workers/first.dock.created
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const joi = require('joi')

const Github = require('models/github')
const Intercom = require('models/intercom')
const FatalGithubError = require('notifications/github.status').FatalGithubError
const SendGrid = require('models/sendgrid')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports = FirstDockCreated

const schema = joi.object({
  githubId: joi.alternatives().try(joi.number(), joi.string()).required(),
  tid: joi.string()
}).required().label('job')

/**
 * Send github PR bot message
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function FirstDockCreated (job) {
  const log = logger.child({
    module: 'FirstDockCreated',
    data: job
  })
  return Promise
    .try(function validateArguments () {
      joi.assert(job, schema)
    })
    .catch(function (err) {
      throw new WorkerStopError('Invalid job', { err: err })
    })
    .then(function () {
      var github = new Github({
        token: process.env.EMAIL_GITHUB_ACCESS_TOKEN
      })
      return github.getUserByIdAsync(parseInt(job.githubId))
    })
    .tap(function (org) {
      if (!org) {
        throw new FatalGithubError('Org did not exist on github')
      }
    })
    .then(function (org) {
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
    .then(function (org, login) {
      var sendGrid = new SendGrid()
      return sendGrid.dockCreated(org)
        .catch(function (err) {
          log.error({ err: err }, 'Failed to send email')
          throw new WorkerStopError('Failed to send email', { err: err })
        })
    })
}
