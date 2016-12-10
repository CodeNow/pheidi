/**
 * Handle `github.pull-request.opened` command.
 * Create `github.bot.notify` jobs for all instances that had a PR opened
 * @module lib/workers/github.pull-request.opened
 */
'use strict'

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
  log.info(query, 'query instances with repo and branch')
  return mongoClient.findInstancesAsync(query)
    .then((instances) => {
      instances = instances || []
      log.info({ numberOfInstances: instances.length }, 'instances instances')
      instances.forEach((instance) => {
        const pushInfo = utils.getPushInfoForInstance(instance)
        if (!pushInfo) {
          log.trace('Instance should not be notified', { instanceId: instance._id.toString() })
          return
        }
        log.trace('Instance will be notified about PR', { pushInfo })
        rabbitmq.publishGitHubBotNotify({ pushInfo, instance })
      })
    })
}
