'use strict'

require('loadenv')()
const GitHubStatus = require('notifications/github.status')
const joi = require('joi')
const keypather = require('keypather')()
const mongodbHelper = require('mongo-helper')
const ObjectID = require('mongodb').ObjectID
const Promise = require('bluebird')
const rabbitmq = require('rabbitmq')
const TaskFatalError = require('ponos').TaskFatalError

module.exports = ContainerLifeCycleDied

const schema = joi.object({
  id: joi.string().required(),
  inspectData: joi.object({
    Config: joi.object({
      Labels: joi.object({
        type: joi.string().required(),
        instanceId: joi.string().required()
      }).unknown().required()
    }).unknown().required()
  }).unknown().required()
}).unknown().required().label('job')

/**
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function ContainerLifeCycleDied (job) {
  return Promise.try(() => {
    joi.assert(job, schema)
  })
    .catch((err) => {
      throw new TaskFatalError(
        'container.life-cycle.died',
        'Invalid job',
        { job: job, err: err }
      )
    })
    .then(() => {
      return Promise.using(mongodbHelper(),
        function (mongoClient) {
          return mongoClient.findOneInstanceAsync({ _id: new ObjectID(job.inspectData.Config.Labels.instanceId) })
        }
      )
    })
    .tap((instance) => {
      if (!instance) {
        throw new TaskFatalError(
          'container.life-cycle.died',
          'Instance not found',
          { report: false, job: job }
        )
      }
      if (!instance.isTesting) {
        throw new TaskFatalError(
          'container.life-cycle.died',
          'Instance is not for testing',
          { report: false, job: job }
        )
      }
    })
    .then((instance) => {
      var mainAcv = (keypather.get(instance, 'contextVersion.appCodeVersions') || [])
        .find(function (acv) {
          return acv && !acv.additionalRepo
        })

      return {
        instance: instance,
        mainAcv: mainAcv
      }
    })
    .tap((data) => {
      if (!data.mainAcv) {
        throw new TaskFatalError(
          'container.life-cycle.died',
          'Instance is not a repo based instance',
          { report: false, job: job }
        )
      }
    })
    .then((data) => {
      const containerStatus = calculateStatus(job)
      if (!containerStatus) {
        return
      }
      const githubStatus = new GitHubStatus()
      return githubStatus.setStatus(data.instance, data.mainAcv, containerStatus)
    })
}

const calculateStatus = (job) => {
  const exitedProperly = job.inspectData.State.ExitCode === 0 && !job.inspectData.State.Error

  if (job.inspectData.Config.Labels.type === 'image-builder-container') {
    // If it's an image builder container we only care if it failed to build
    if (!exitedProperly) {
      return 'failure'
    }
  } else {
    if (exitedProperly) {
      return 'success'
    }
    return 'error'
  }
}