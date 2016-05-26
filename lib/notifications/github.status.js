'use strict'

const Github = require('models/github')
const isString = require('101/is-string')
const keypather = require('keypather')()
const noop = require('101/noop')
const Promise = require('bluebird')
const logger = require('logger')

const descriptions = {
  pending: 'Tests are running',
  success: 'Tests completed successfully',
  error: 'Tests did not pass',
  failure: 'The tests were unable to run'
}

const getToken = () => {
  if (!isString(process.env.RUNNABOT_GITHUB_ACCESS_TOKENS)) {
    throw new Error('Configuration error: runnabot gh access token is not defined')
  }
  const tokens = process.env.RUNNABOT_GITHUB_ACCESS_TOKENS.split(',')
  if (!tokens || tokens.length === 0) {
    return null
  }
  const randomIndex = Math.floor(Math.random() * tokens.length)
  return tokens[randomIndex]
}

/**
 * Module that is responsible for creating GitHub statuses
 * @class
 */
class GithubStatus {

  constructor () {
    this.github = new Github({ token: getToken() })
  }

  setStatus (instance, mainAcv, state, customDescription) {
    const log = logger.child({
      module: 'GithubStatus.setStatus',
      state: state,
      instanceId: instance._id,
      instanceName: instance.name,
      repo: mainAcv.lowerRepo.split('/')[1],
      user: mainAcv.lowerRepo.split('/')[0],
      sha: mainAcv.commit
    })
    log.info('called')
    return Promise.fromCallback((cb) => {
      this.github.repos.createStatus({
        user: mainAcv.lowerRepo.split('/')[0],
        repo: mainAcv.lowerRepo.split('/')[1],
        sha: mainAcv.commit,
        state: state,
        target_url: createTargetUrl(instance),
        description: customDescription || descriptions[state],
        context: 'runnable/' + instance.name
      }, cb)
    })
  }
}

function createTargetUrl (instance) {
  const owner = keypather.get(instance, 'owner.username')
  return process.env.WEB_URL + '/' + owner + '/' + instance.name
}

module.exports = GithubStatus
