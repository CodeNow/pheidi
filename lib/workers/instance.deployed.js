/**
 * Handle instance deployed event.
 * Send notifications.
 * @module lib/workers/instance.deployed
 */
'use strict'

require('loadenv')()
var Promise = require('bluebird')

var joi = require('joi')
// var PullRequest = require('models/pullrequest')
var mongodbHelper = require('mongo-helper')
// var Slack = require('notifications/index')
var TaskFatalError = require('ponos').TaskFatalError
var logger = require('logger')

module.exports = InstanceDeployed

const schema = joi.object({
  instanceId: joi.string().required(),
  cvId: joi.string().required()
}).required().label('job')

/**
 * Flow:
 * 1. find instance and cv
 * 2. find instanceUser and pushUser
 * 3. send slack notification to the pushUser if exists
 * 4. send github PR deploy message
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
function InstanceDeployed (job) {
  var log = logger.child({
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
            mongoClient.findOneInstanceAsync({ _id: job.instanceId }),
            mongoClient.findOneContextVersionAsync({ _id: job.cvId })
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
              // instanceUser is the user who created an instance
              instanceUser: mongoClient.findOneUserAsync({ 'actions.github.id': instance.createdBy.github }),
              // pushUser is the user who created context version
              pushUser: mongoClient.findOneUserAsync({ 'actions.github.id': cv.createdBy.github }),
              // settings for the org
              seetings: mongoClient.findOneSettingAsync({ 'owner.github': instance.owner.github })
            }).then(function (result) {
              // instance user is mandatory. fail if it's not in db
              if (!result.instanceUser) {
                throw new TaskFatalError(
                  'instance.deployed',
                  'Instance creator not found',
                  { report: false, job: job }
                )
              }
              log.info('worker found all the data')
              return
            })
          })
        })
    })
}
