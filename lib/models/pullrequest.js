/**
 * @module lib/models/pullrequest
 */
'use strict'

const Warning = require('error-cat/errors/warning')
const keypather = require('keypather')()
const noop = require('101/noop')
const put = require('101/put')

const Github = require('models/github')
const logger = require('logger')

module.exports = PullRequest

function PullRequest (githubToken) {
  this.github = new Github({token: githubToken})
}

/**
 * This calls GitHub Deployments API.
 * Creates new deployment.
 *
 * @param  {Object}   gitInfo       gitInfo with `repo` and `commit`
 * @param  {String}   instanceName  instanceName
 * @param  {Function} cb            standard callback
 */
PullRequest.prototype.createDeployment = function (gitInfo, instanceName, cb) {
  var log = logger.child({
    tx: true,
    gitInfo: gitInfo,
    instanceName: instanceName,
    method: 'createDeployment'
  })
  log.info('call')
  if (process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES !== 'true') {
    return cb(null)
  }
  var description = 'Deploying to ' + instanceName + ' on Runnable.'
  var query = {
    task: 'deploy',
    auto_merge: false,
    environment: 'runnable',
    description: description,
    ref: gitInfo.commit,
    payload: JSON.stringify({}),
    required_contexts: [] // we skip check on all `contexts` since we still can deploy
  }
  this.github.createDeployment(gitInfo.repo, query, cb)
}

/**
 * This calls GitHub Deployments API and puts `deployment` into
 * `success` state
 * **Fire & forget** - there is no callback to this function.
 * @param  {Object}   gitInfo       gitInfo with `repo` and `commit`
 * @param  {Object}   instance      instance
 */
PullRequest.prototype.deploymentSucceeded = function (gitInfo, instance) {
  var log = logger.child({
    tx: true,
    gitInfo: gitInfo,
    instance: instance,
    method: 'deploymentSucceeded'
  })
  log.info('call')
  this.createDeployment(gitInfo, instance.name, function (err, deployment) {
    if (err || !deployment) { return }
    var description = 'Deployed to ' + instance.name + ' on Runnable.'
    this._deploymentStatus(gitInfo, deployment.id, 'success', description, instance)
  }.bind(this))
}

PullRequest.prototype._deploymentStatus = function (gitInfo, deploymentId, state, description, instance, cb) {
  var logData = {
    tx: true,
    gitInfo: gitInfo,
    deploymentId: deploymentId,
    state: state,
    description: description,
    instance: instance,
    method: '_deploymentStatus'
  }
  var log = logger.child(logData)
  log.info('call')
  cb = cb || noop
  if (process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES !== 'true') {
    return cb(null)
  }
  if (!deploymentId) {
    return cb(new Warning('Deployment id is not found'))
  }
  var targetUrl = createTargetUrl(instance)
  var payload = {
    id: deploymentId,
    state: state,
    target_url: targetUrl,
    description: description
  }
  this.github.createDeploymentStatus(gitInfo.repo, payload, function (err, res) {
    if (err) {
      log.error({ err: err, targetUrl: targetUrl }, 'error')
    } else {
      log.trace({ targetUrl: targetUrl }, 'success')
    }
    cb(err, res)
  })
}

function createTargetUrl (instance) {
  var owner = keypather.get(instance, 'owner.username')
  return process.env.WEB_URL + '/' + owner + '/' + instance.name
}
