'use strict'

require('loadenv')()
const FatalGithubError = require('notifications/github.status').FatalGithubError
const GitHubStatus = require('notifications/github.status')
const joi = require('joi')
const keypather = require('keypather')()
const logger = require('logger')
const mongodbHelper = require('mongo-helper')
const ObjectID = require('mongodb').ObjectID
const PreconditionError = require('notifications/github.status').PreconditionError
const Promise = require('bluebird')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

module.exports = ContainerLifeCycleStarted

const schema = joi.object({
  id: joi.string().required(),
  inspectData: joi.object({
    Config: joi.object({
      Labels: joi.object({
        type: joi.string().required(),
        'contextVersionId': joi.alternatives().when('type', {
          is: 'user-container',
          then: joi.string().required()
        }),
        'contextVersion._id': joi.alternatives().when('type', {
          is: 'image-builder-container',
          then: joi.string().required()
        })
      }).unknown().required()
    }).unknown().required()
  }).unknown().required()
}).unknown().required().label('job')

/**
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function ContainerLifeCycleStarted (job) {
  let log = logger.child({
    module: 'container.life-cycle.started',
    data: job
  })
  return Promise.try(() => {
    joi.assert(job, schema)
  })
    .catch((err) => {
      throw new WorkerStopError('Invalid job', { err: err })
    })
    .then(() => {
      return Promise.using(mongodbHelper.helper(),
        function (mongoClient) {
          var cvId = job.inspectData.Config.Labels['contextVersion._id'] || job.inspectData.Config.Labels['contextVersionId']
          log.trace({cvId: cvId}, 'searching for instances by contextVersion')
          return mongoClient.findOneContextVersionAsync({_id: ObjectID(cvId)})
            .then((contextVersion) => {
              if (!contextVersion) {
                throw new WorkerStopError(
                  'Could not find context version by id',
                  { level: 'info', cvId: cvId }
                )
              }
              return Promise.fromCallback((cb) => {
                mongoClient.db.collection('instances')
                  .find({
                    'contextVersion.context': ObjectID(contextVersion.context),
                    isTesting: true
                  })
                  .toArray(cb)
              })
            })
        }
      )
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
      var mainAcv = (keypather.get(instance, 'contextVersion.appCodeVersions') || [])
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
