/**
 * Handle instance deployed event.
 * Send notifications.
 * @module lib/workers/instance.deployed
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const ObjectID = require('mongodb').ObjectID
const joi = require('joi')
const PullRequest = require('models/pullrequest')
const mongodbHelper = require('mongo-helper')
const GitHubBot = require('notifications/github.bot')
const Slack = require('notifications/slack')
const TaskFatalError = require('ponos').TaskFatalError
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
  return Promise.resolve()
    .then(function validateArguments () {
      return Promise.try(function () {
        joi.assert(job, schema)
      }).catch(function (err) {
        throw new TaskFatalError(
          'instance.deployed',
          'Invalid job',
          { job: job, err: err }
        )
      })
    })
    .then(function connectToMongo () {
      return Promise.using(mongodbHelper(),
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
              throw new TaskFatalError(
                'instance.deployed',
                'Instance not found',
                { report: false, job: job }
              )
            }
            if (!cv) {
              throw new TaskFatalError(
                'instance.deployed',
                'ContextVersion not found',
                { report: false, job: job }
              )
            }
            return Promise.props({
              // instanceCreator is the user who created an instance
              instanceCreator: mongoClient.findOneUserAsync({ 'accounts.github.id': instance.createdBy.github }),
              // pushUser is the user who created context version
              pushUser: mongoClient.findOneUserAsync({ 'accounts.github.id': cv.createdBy.github }),
              // settings for the org
              settings: mongoClient.findOneSettingAsync({ 'owner.github': instance.owner.github })
            }).then(function (result) {
              // instance user is mandatory. fail if it's not in db
              if (!result.instanceCreator) {
                throw new TaskFatalError(
                  'instance.deployed',
                  'Instance creator not found',
                  { report: false, job: job }
                )
              }
              log.info('worker found all the data')
              const activeUser = result.pushUser || result.instanceCreator
              const accessToken = activeUser.accounts.github.accessToken
              const pushInfo = cv.build.triggeredAction.appCodeVersion
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
                const pullRequest = new PullRequest(accessToken)
                pullRequest.deploymentSucceeded(pushInfo, instance)
              }
              if (pushInfo) {
                const githubBot = new GitHubBot()
                githubBot.upsertComments(pushInfo, instance, function (err) {
                  if (err) {
                    log.error({ err: err }, 'github bot notification error')
                  } else {
                    log.info('github bot notification success')
                  }
                })
              }
              return
            })
          })
        })
    })
}
