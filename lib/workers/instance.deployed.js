/**
 * Handle `instance.deployed` event.
 * Send notifications.
 * @module lib/workers/instance.deployed
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const ObjectID = require('mongodb').ObjectID
const joi = require('joi')
const keypather = require('keypather')()
const mongodbHelper = require('mongo-helper')

const GitHubDeploy = require('notifications/github.deploy')
const Slack = require('notifications/slack')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const logger = require('logger')

module.exports = InstanceDeployed

const schema = joi.object({
  instanceId: joi.string().required(),
  cvId: joi.string().required()
}).required().label('job')

/**
 * Flow:
 * 1. find instance and cv
 * 2. find instanceCreator and pushUser and settings
 * 3. send slack notification to the pushUser if exists
 * 4. send github PR deploy message
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function InstanceDeployed (job) {
  const log = logger.child({
    module: 'InstanceDeployed',
    data: job
  })
  return Promise.try(function () {
      joi.assert(job, schema)
    }).catch(function (err) {
      throw new WorkerStopError(
        'Invalid job',
        { err: err }
      )
    })
    .then(function connectToMongo () {
      return Promise.using(mongodbHelper.helper(),
        function (mongoClient) {
          return Promise.join(
            mongoClient.findOneInstanceAsync({ _id: new ObjectID(job.instanceId) }),
            mongoClient.findOneContextVersionAsync({ _id: new ObjectID(job.cvId) })
          )
          .spread(function validateModels (instance, cv) {
            log.trace({
              instance: instance,
              cv: cv
            }, 'notify external found instance and cv')
            if (!instance) {
              throw new WorkerStopError('Instance not found', { level: 'info' })
            }
            if (!keypather.get(instance, 'owner.username')) {
              throw new WorkerStopError('Instance owner username was not found')
            }
            if (!cv) {
              throw new WorkerStopError('ContextVersion not found', { level: 'info' })
            }
            const tasks = {
              // instanceCreator is the user who created an instance
              instanceCreator: mongoClient.findOneUserAsync({ 'accounts.github.id': instance.createdBy.github }),
              // pushUser is the user who created context version
              pushUser: mongoClient.findOneUserAsync({ 'accounts.github.id': cv.createdBy.github }),
              // settings for the org
              settings: mongoClient.findOneSettingAsync({ 'owner.github': instance.owner.github })
            }
            return Promise.props(tasks)
              .then(function (result) {
                // instance user is mandatory. fail if it's not in db
                if (!result.instanceCreator) {
                  throw new WorkerStopError('Instance creator not found', { level: 'info' })
                }
                log.info('worker found all the data')
                result.activeUser = result.pushUser || result.instanceCreator
                result.accessToken = result.activeUser.accounts.github.accessToken
                result.pushInfo = cv.build.triggeredAction.appCodeVersion
                return result
              })
              .then(function (result) {
                const pushInfo = result.pushInfo
                // if pushUser is not defined there is no one we should notify
                if (result.settings && result.pushUser) {
                  const slack = new Slack(result.settings, instance.owner.github)
                  slack.notifyOnAutoDeploy(pushInfo, result.pushUser.accounts.github.username,
                    instance, function (err) {
                      if (err) {
                        log.error({ err: err }, 'slack notification error')
                      } else {
                        log.info('slack notification success')
                      }
                    })
                }
                if (pushInfo && pushInfo.commit) {
                  const gitHubDeploy = new GitHubDeploy(result.accessToken)
                  gitHubDeploy.deploymentSucceeded(pushInfo, instance)
                }
                return
              })
          })
        })
    })
}
