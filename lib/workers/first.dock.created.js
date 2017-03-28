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
const orion = require('@runnable/orion')

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

      return orion.users.find({ email })
        .then((res) => (res.body))
        .tap((user) => {
          if (!user.id) {
            throw new WorkerStopError('Failed to find user in Intercom with email', { email })
          }
        })
        .then((user) => {
          return orion.tags.tag({name: 'InfrastructureReady', users: [{ id: user.id }]})
        })
        .catch((err) => {
          log.error({ err: err }, 'Failed to communicate with Intercom')
          throw new WorkerStopError('Failed to communicate with Intercom', { err })
        })
    })
}
