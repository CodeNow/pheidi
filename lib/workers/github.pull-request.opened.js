/**
 * Handle `github.pull-request.opened` command.
 * Create `github.bot.notify` jobs for all instances that had a PR opened
 * @module lib/workers/github.pull-request.opened
 */
'use strict'

const Promise = require('bluebird')
require('loadenv')()

const utils = require('models/utils')
const rabbitmq = require('rabbitmq')
const mongoClient = require('mongo-helper').client
const schemas = require('models/schemas')
const logger = require('logger')

module.exports.jobSchema = schemas.githubPullRequestOpened

/**
 * Enqueue github.bot.notify for all instances that had a PR opened
 * @param {Object} job - Job info
 * @returns {Promise}
 * @resolve {undefined}
 */
module.exports.task = (job) => {
  const repo = job.payload.pull_request.head.repo.full_name
  const branch = job.payload.pull_request.head.ref
  const log = logger.child({
    module: 'GitHubPullRequestOpened',
    repo,
    branch
  })
  const query = {
    'contextVersion.appCodeVersions': {
      $elemMatch: {
        lowerRepo: repo.toLowerCase(),
        lowerBranch: branch.toLowerCase(),
        additionalRepo: { $ne: true }
      }
    }
  }
  log.info({ query }, 'query instances with repo and branch')
  return mongoClient.findInstancesAsync(query)
    .then((instances) => {
      instances = instances || []
      log.info({ numberOfInstances: instances.length }, 'instances found')
      return Promise.map(instances, (instance) => {
        return Promise.try(() => {
          return utils.getPushInfoForInstance(instance)
        })
        .then((pushInfo) => {
          log.trace({ pushInfo }, 'Instance will be notified about PR')
          // Comply with the schema for `github.bot.notify`
          instance.contextVersions = [ instance.contextVersion ]
          rabbitmq.publishGitHubBotNotify({ pushInfo, instance })
        })
        .catch((err) => {
          log.trace({ instanceId: instance._id.toString(), err }, 'Instance should not be notified')
        })
      })
    })
}
