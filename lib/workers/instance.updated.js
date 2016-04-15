/**
 * Handle `instance.updated` event.
 * Send notifications.
 * @module lib/workers/instance.updated
 */
'use strict'

require('loadenv')()
const Promise = require('bluebird')

const ObjectID = require('mongodb').ObjectID
const joi = require('joi')
const mongodbHelper = require('mongo-helper')

const GitHubBot = require('notifications/github.bot')
const GitHubDeploy = require('notifications/github.deploy')
const Slack = require('notifications/slack')
const TaskFatalError = require('ponos').TaskFatalError
const logger = require('logger')

module.exports = InstanceUpdated

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
function InstanceUpdated (job) {
  const log = logger.child({
    module: 'InstanceUpdated',
    data: job
  })
  log.info('call')
  return Promise.resolve()
    .then(function start () {
      log.info('start')
      return
    })
}
