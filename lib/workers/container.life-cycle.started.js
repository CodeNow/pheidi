'use strict'

require('loadenv')()
const FatalGithubError = require('notifications/github.status').FatalGithubError
const GitHubStatus = require('notifications/github.status')
const joi = require('joi')
const keypather = require('keypather')()
const mongodbHelper = require('mongo-helper')
const ObjectID = require('mongodb').ObjectID
const PreconditionError = require('notifications/github.status').PreconditionError
const Promise = require('bluebird')
const TaskFatalError = require('ponos').TaskFatalError

module.exports = ContainerLifeCycleStarted

const schema = joi.object({
  id: joi.string().required(),
  inspectData: joi.object({
    Config: joi.object({
      Labels: joi.object({
        type: joi.string().required(),
        'contextVersion._id': joi.string().required()
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
  return Promise.try(() => {
    joi.assert(job, schema)
  })
    .catch((err) => {
      throw new TaskFatalError(
        'container.life-cycle.started',
        'Invalid job',
        { job: job, err: err }
      )
    })
    .then(() => {
      return Promise.using(mongodbHelper.helper(),
        function (mongoClient) {
          return Promise.fromCallback((cb) => {
            mongoClient.db.collection('instances')
              .find({
                'contextVersion._id': ObjectID(job.inspectData.Config.Labels['contextVersion._id']),
                isTesting: true
              })
              .toArray(cb)
          })
        }
      )
    })
    .tap((instances) => {
      if (instances.length === 0) {
        throw new TaskFatalError(
          'container.life-cycle.started',
          'Testing instance not found with context version id',
          { report: false, job: job }
        )
      }
    })
    .each((instance) => {
      var mainAcv = (keypather.get(instance, 'contextVersion.appCodeVersions') || [])
        .find(function (acv) {
          return acv && !acv.additionalRepo
        })

      if (!mainAcv) {
        throw new TaskFatalError(
          'container.life-cycle.started',
          'Instance is not a repo based instance',
          { report: false, job: job }
        )
      }
      const githubStatus = new GitHubStatus()
      return githubStatus.setStatus(instance, mainAcv, 'pending')
        .catch(PreconditionError, (err) => {
          throw new TaskFatalError(
            'container.life-cycle.started',
            'Preconditions failed to report to github',
            { originalError: err }
          )
        })
        .catch(FatalGithubError, (err) => {
          throw new TaskFatalError(
            'container.life-cycle.started',
            'Github error when setting status',
            { originalError: err }
          )
        })
    })
}
