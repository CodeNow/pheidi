/**
 * @module lib/models/pullrequest
 */
'use strict'

const Warning = require('error-cat/errors/warning')
const keypather = require('keypather')()
const noop = require('101/noop')

const Github = require('models/github')
const logger = require('logger').child({ module: 'notifications/github-deploy' })

/**
 * Module that is responsible for creating GitHub deployment statuses.
 * @class
 */
class GitHubDeploy {

  constructor (githubToken) {
    this.github = new Github({ token: githubToken })
  }

  /**
   * This calls GitHub Deployments API.
   * Creates new deployment.
   *
   * @param  {Object}   gitInfo       gitInfo with `repo` and `commit`
   * @param  {String}   instanceName  instanceName
   * @param  {Function} cb            standard callback
   */
  createDeployment (gitInfo, instanceName, cb) {
    const log = logger.child({
      gitInfo: gitInfo,
      instanceName: instanceName,
      method: 'createDeployment'
    })
    log.info('call')
    if (process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES !== 'true') {
      return cb(null)
    }
    const description = 'Deploying to ' + instanceName + ' on Runnable.'
    const query = {
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
  deploymentSucceeded (gitInfo, instance) {
    const log = logger.child({
      gitInfo: gitInfo,
      instance: instance,
      method: 'deploymentSucceeded'
    })
    log.info('call')
    this.createDeployment(gitInfo, instance.name, (err, deployment) => {
      if (err || !deployment) {
        log.error({ err: err }, 'failed to mark deployment as succeeded')
        return
      }
      const description = 'Deployed to ' + instance.name + ' on Runnable.'
      this._deploymentStatus(gitInfo, deployment.id, 'success', description, instance)
    })
  }

  _deploymentStatus (gitInfo, deploymentId, state, description, instance, cb) {
    const logData = {
      gitInfo: gitInfo,
      deploymentId: deploymentId,
      state: state,
      description: description,
      instance: instance,
      method: '_deploymentStatus'
    }
    const log = logger.child(logData)
    log.info('call')
    cb = cb || noop
    if (process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES !== 'true') {
      return cb(null)
    }
    if (!deploymentId) {
      return cb(new Warning('Deployment id is not found'))
    }
    const targetUrl = createTargetUrl(instance)
    const payload = {
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
}

function createTargetUrl (instance) {
  const owner = keypather.get(instance, 'owner.username')
  return process.env.WEB_URL + '/' + owner + '/' + instance.name
}

module.exports = GitHubDeploy
