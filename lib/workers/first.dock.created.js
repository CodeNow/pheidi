/**
 * Handle `first.dock.created` command.
 * Send email to inform that infrastructure is up
 * @module lib/workers/first.dock.created
 */
'use strict'

require('loadenv')()

const joi = require('joi')
const keypather = require('keypather')()
const logger = require('logger')
const Intercom = require('intercom-client')

const mongoClient = require('mongo-helper').client
const bigPoppa = require('models/big-poppa')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = joi.object({
  githubId: joi.alternatives().try(joi.number(), joi.string()).required()
}).unknown().required()

/**
 * Send email to organization creator when first dock is created
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const log = logger.child({
    module: 'FirstDockCreated',
    data: job
  })
  const intercomClient = new Intercom.Client({ appId: process.env.INTERCOM_APP_ID, appApiKey: process.env.INTERCOM_API_KEY })
  return bigPoppa.getOrganizations({ githubId: job.githubId })
    .get(0)
    .then((org) => {
      if (!org) {
        throw new WorkerStopError('Org did not exist in bigPoppa.', {}, { level: 'info' })
      }
      return [ org, mongoClient.findOneUserAsync({
        'accounts.github.id': org.creator.githubId
      })]
    })
    .spread((org, user) => {
      const email = keypather.get(user, 'email')
      const username = keypather.get(user, 'accounts.github.username')
      return intercomClient.users.find({ email: email })
        .then((res) => (res.body))
        .tap((user) => {
          if (!user.id) {
            throw new WorkerStopError('Failed to find user in Intercom with email', { email })
          }
        })
        .then((user) => {
          var message = {
            message_type: 'email',
            subject: 'Your Infrastructure Is Ready',
            body: 'Hey ' + username + ',<br><br>' +
              'Thanks for signing up!<br> Your infrastructure is ready, the <b>' + org.name +
              '</b> environment is good to go.<br><br>' + '<a href="https://app.runnable.io/' + org.name +
              '">Go to Runnable.</a><br><br>' + 'Your account is free to use for 14 days. ' +
              'If you get stuck setting up, just reply to this email. <br><br>' +
              'Your best friend,<br>Praful Rana<br>Customer Success @ Runnable',
            template: 'plain',
            from: {
              type: 'admin',
              id: process.env.INTERCOM_ADMIN_ID || '22382'
            },
            to: {
              type: 'user',
              id: user.id
            }
          }

          return intercomClient.messages.create(message)
            .catch((err) => {
              log.error({ err: err }, 'Failed to send Intercom Admin Initiated Conversation')
              throw new WorkerStopError(('Failed to send Intercom Admin Initiated Conversation', { err: err }))
            })
        })
        .catch((err) => {
          log.error({ err: err }, 'Failed to communicate with Intercom')
          throw new WorkerStopError('Failed to communicate with Intercom', { err: err })
        })
    })
}
