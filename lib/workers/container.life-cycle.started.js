'use strict'

require('loadenv')()
const FatalGithubError = require('notifications/github.status').FatalGithubError
const GitHubStatus = require('notifications/github.status')
const keypather = require('keypather')()
const logger = require('logger')
const mongoClient = require('mongo-helper').client
const ObjectID = require('mongodb').ObjectID
const PreconditionError = require('notifications/github.status').PreconditionError
const Promise = require('bluebird')
const schemas = require('models/schemas')
const utils = require('models/utils')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports.jobSchema = schemas.containerLifeCycleEvent

/**
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  let log = logger.child({
    module: 'container.life-cycle.started',
    data: job
  })
  if (utils.ignoreContainerLifeCycleJob(job)) {
    return Promise.resolve()
  }
  return Promise
    .try(() => {
      const cvId = job.inspectData.Config.Labels['contextVersion._id'] || job.inspectData.Config.Labels['contextVersionId']
      log.trace({ cvId: cvId }, 'searching for instances by contextVersion')
      return mongoClient.findOneContextVersionAsync({_id: new ObjectID(cvId)})
        .then((contextVersion) => {
          if (!contextVersion) {
            throw new WorkerStopError(
              'Could not find context version by id',
              { cvId: cvId }, { level: 'info' }
            )
          }
          return mongoClient.findInstancesAsync({
            'contextVersion.context': new ObjectID(contextVersion.context),
            isTesting: true
          })
        })
    })
    .tap((instances) => {
      if (!instances || instances.length === 0) {
        throw new WorkerStopError(
          'Testing instance not found with context version id',
          { instances: instances }, { level: 'info' }
        )
      }
      log.trace({instances: instances}, 'Matched testing instances')
    })
    .each((instance) => {
      const mainAcv = (keypather.get(instance, 'contextVersion.appCodeVersions') || [])
        .find(function (acv) {
          return acv && !acv.additionalRepo
        })

      if (!mainAcv) {
        throw new WorkerStopError('Instance is not a repo based instance', {}, { level: 'info' })
      }
      const githubStatus = new GitHubStatus()
      const status = job.inspectData.Config.Labels.type === 'user-container' ? 'Tests are running' : 'Test container is building'
      log.trace({status: status, instance: instance._id}, 'Populating github status for instance')
      return githubStatus.setStatus(instance, mainAcv, 'pending', status)
        .catch(PreconditionError, (err) => {
          throw new WorkerStopError(
            'Preconditions failed to report to github',
            { originalError: err }
          )
        })
        .catch(FatalGithubError, (err) => {
          throw new WorkerStopError(
            'Github error when setting status',
            { originalError: err }
          )
        })
    })
}
