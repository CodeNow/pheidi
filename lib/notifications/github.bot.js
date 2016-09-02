'use strict'

const Promise = require('bluebird')
const async = require('async')
const clone = require('101/clone')
const isEmpty = require('101/is-empty')
const isString = require('101/is-string')
const keypather = require('keypather')()
const pluck = require('101/pluck')
const runnableHostname = require('runnable-hostname')
const GitHub = require('models/github')
const tracker = require('models/tracker')
const utils = require('models/utils')
const logger = require('logger').child({ module: 'notifications/github-bot' })

function getToken () {
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
 * Module that implements @runnabot - runnable GitHub bot that comments on customers PRs.
 * @class
 */
class GitHubBot {

  constructor () {
    this.github = new GitHub({ token: getToken() })
  }

  /**
   * Notify all PR pages about instance deploy event.
   * First check if @runnabot is enabled and if it was invited into the org
   * @param {Object} pushInfo push info that has repo, branch, commit
   * @param {Object} instance instance for which event was received
   * @param {Array} isolatedInstances array of isolated instances if any
   * @param {Function} cb - standard callback
   */
  notifyOnUpdate (pushInfo, instance, isolatedInstances, cb) {
    const log = logger.child({
      pushInfo: pushInfo,
      instance: instance,
      isolatedInstances: isolatedInstances.length,
      method: 'notifyOnUpdate'
    })
    log.info('call')
    if (process.env.ENABLE_GITHUB_PR_COMMENTS !== 'true') {
      log.trace('github pr comments disabled')
      return cb(null)
    }
    this.github.acceptInvitation(instance.owner.username, (err) => {
      if (err) {
        log.error({ err: err }, 'runnabot is not a member of an org')
        return cb(err)
      }
      log.trace('runnabot is a member of an org')
      this._upsertComments(pushInfo, instance, isolatedInstances, cb)
    })
  }

  /**
   * Delete notifications for all PRs opened for the repo and branch
   * @param {Object} pushInfo push info that has repo, branch
   * @return {Promise}
   */
  deleteBranchNotifications (pushInfo) {
    const log = logger.child({
      pushInfo: pushInfo,
      method: 'deleteNotification'
    })
    log.info('call')
    return this.github.listOpenPullRequestsForBranchAsync(pushInfo.repo, pushInfo.branch)
     .then((prs) => {
        log.trace({ prs: prs }, 'found prs')
        const ids = prs.map(pluck('number'))
        return Promise.map(ids, (id, callback) => {
          const gitInfo = clone(pushInfo)
          gitInfo.number = id
          return this._deleteComments(gitInfo)
        })
      })
  }

  /**
   * Delete notifications for all PRs opened for the repo
   * @param {Object} pushInfo push info that has repo
   * @return {Promise}
   */
  deleteAllNotifications (pushInfo) {
    const log = logger.child({
      pushInfo: pushInfo,
      method: 'deleteNotification'
    })
    log.info('call')
    return this.github.listOpenPullRequestsAsync(pushInfo.repo)
      .then((prs) => {
        log.trace({ prs: prs }, 'found prs')
        const ids = prs.map(pluck('number'))
        return Promise.map(ids, (id) => {
          const gitInfo = clone(pushInfo)
          gitInfo.number = id
          return this._deleteComments(gitInfo)
        })
      })
  }

  _deleteComments (gitInfo) {
    const log = logger.child({
      gitInfo: gitInfo,
      method: '_deleteComments'
    })
    log.info('call')
    return this.github.findCommentsByUserAsync(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME)
      .then((comments) => {
        return this._deleteListOfComments(gitInfo.repo, comments)
      })
  }

  _deleteListOfComments (repo, comments) {
    return Promise.map(comments, (comment) => {
      return this.github.deleteCommentAsync(repo, comment.id)
    })
  }

  /**
   * Ensure runnabot has no more than 1 comment per instance on the PR page.
   * Duplicate comments can happen because of race condition - when we receive
   * two jobs
   * @param {Object} gitInfo push info that has repo, branch, commit and PR number
   * @param {Object} instance instance for whu we need to delete duplicates if any
   * @return {Promise}
   */
  _ensureNoDuplicates (gitInfo, instance) {
    const log = logger.child({
      gitInfo: gitInfo,
      method: '_ensureNoDuplicates'
    })
    log.info('call')
    return this.github.findCommentsByUserAsync(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (comments) => {
        const instanceComments = this._findCommentsByInstance(comments, instance)
        if (instanceComments.length > 1) {
          // remove top comment - which should still remain
          instanceComments.pop()
          return this._deleteListOfComments(gitInfo.repo, instanceComments)
        }
      })
  }

  /**
   * Find comment that has link to the specified instance
   * @param {Array} array of github comments
   * @param {Object} instance object for which we are searching matching comment
   * @return {Array|Object} array of comments that were created for the specific instance or []
   */
  _findCommentsByInstance (comments, instance) {
    if (!comments || isEmpty(comments)) {
      return []
    }
    return comments.filter((comment) => {
      // if comment link has name of the instance we found appropriate comment
      return comment && comment.body && comment.body.includes(instance._id)
    })
  }

  /**
   * Upsert (create new or update existing one) comment from runnabot on the corresponding PR.
   * @param {Object} gitInfo push info that has repo, branch, commit and PR number
   * @param {Object} instance instance for which event was received
  * @param {Array} isolatedInstances array of isolated instances if any
   * @param {Function} cb - standard callback
   */
  _upsertComment (gitInfo, instance, isolatedInstances, cb) {
    const log = logger.child({
      gitInfo: gitInfo,
      instance: instance,
      isolatedInstances: isolatedInstances.length,
      method: 'upsertComment'
    })
    log.info('call')
    // creates function to handle response from github
    const self = this
    const done = function (messageId, message) {
      return function (err, resp) {
        if (err) {
          tracker.del(messageId)
          return cb(err)
        }
        self._ensureNoDuplicates(gitInfo, instance).asCallback(function (err) {
          cb(err, resp)
        })
      }
    }
    this.github.findCommentsByUserAsync(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME)
      .asCallback((err, comments) => {
        if (err) {
          log.error({ err: err }, 'error looking for a comment')
          return cb(err)
        }
        const newMessage = this._render(gitInfo, instance, isolatedInstances)
        log.info({ message: newMessage }, 'rendered message')
        if (!newMessage) {
          log.info('message is null, do not send anything')
          return cb(null)
        }
        const messageId = gitInfo.repo + '/' + gitInfo.number + '/' + instance._id
        const tracked = tracker.get(messageId)
        log.info({
          keys: tracker.keys(),
          messageId: messageId,
          message: newMessage,
          tracked: tracked
        }, 'cache data')
        if (tracked && tracked === newMessage) {
          log.trace('message already sent')
          return cb(null)
        }
        tracker.set(messageId, newMessage)
        const instanceComments = this._findCommentsByInstance(comments, instance)
        if (instanceComments.length === 0) {
          log.trace('creating new comment')
          return this.github.addComment(gitInfo.repo, gitInfo.number, newMessage, done(messageId, newMessage))
        }
        log.trace('delete old comments')
        this._deleteListOfComments(gitInfo.repo, instanceComments).asCallback((err) => {
          if (err) {
            return done(messageId, newMessage)(err)
          }
          this.github.addComment(gitInfo.repo, gitInfo.number, newMessage, done(messageId, newMessage))
        })
      })
  }

  /**
   * Find all existing PRs based on the `pushInfo.repo` and `pushInfo.branch`.
   * For each found PR new comment should be upserted.
   * @param {Object} pushInfo push info that has repo, branch, commit
   * @param {Object} instance instance for which event was received
   * @param {Array} isolatedInstances array of isolated instances if any
   * @param {Function} cb - standard callback
   */
  _upsertComments (pushInfo, instance, isolatedInstances, cb) {
    const log = logger.child({
      pushInfo: pushInfo,
      instance: instance,
      isolatedInstances: isolatedInstances.length,
      method: 'upsertComments'
    })
    log.info('call')
    this.github.listOpenPullRequestsForBranch(pushInfo.repo, pushInfo.branch, (err, prs) => {
      if (err) {
        log.error({ err: err }, 'find open prs')
        return cb(err)
      }
      log.trace({ prs: prs }, 'found prs')
      const ids = prs.map(pluck('number'))
      async.map(ids, (id, callback) => {
        const gitInfo = clone(pushInfo)
        gitInfo.number = id
        this._upsertComment(gitInfo, instance, isolatedInstances, callback)
      }, cb)
    })
  }

  _renderFooter (isolatedInstances) {
    let isolatedLinks = this._renderIsolatedInstance(isolatedInstances)
    if (isolatedLinks.length === 0) {
      return '\n<sub>*From [Runnable](http://runnable.com)*</sub>'
    }
    return '\n' + isolatedLinks + '*— From [Runnable](http://runnable.com)*</sub>'
  }

  _renderIsolatedInstance (isolatedInstances) {
    let message = ''
    if (isolatedInstances && !isEmpty(isolatedInstances)) {
      message += '<sub>Related containers: '
      const linksList = isolatedInstances.map((instance) => {
        const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' +
            instance.name
        const readableInstanceName = this._cleanupInstanceName(instance.name)
        const link = this._createMarkdownLink(readableInstanceName, instanceUrl)
        const statusIcon = this._renderStatusIcon(utils.instanceState(instance))
        return statusIcon + ' ' + link
      })
      message += linksList.join(' ')
    }
    return message
  }

  _renderStatusIcon (state) {
    if (state === 'running') {
      return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9">'
    }
    if (state === 'stopped') {
      return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-gray.svg" title="Stopped" width="9" height="9">'
    }
    if (state === 'building') {
      return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-orange.svg" title="Building" width="9" height="9">'
    }
    return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9">'
  }

  _render (gitInfo, instance, isolatedInstances) {
    const opts = {
      shortHash: instance.shortHash,
      instanceName: instance.name,
      branch: gitInfo.branch,
      ownerUsername: instance.owner.username,
      masterPod: instance.masterPod,
      userContentDomain: process.env.USER_CONTENT_DOMAIN
    }
    // each message has metadata specified as html comments
    let message = '<!--'
    message += 'instanceId:' + instance._id
    message += '-->'

    message += 'Deployed '
    const statusIcon = this._renderStatusIcon(gitInfo.state)
    message += statusIcon + ' '
    const containerUrl = process.env.CONTAINER_URL_PROTOCOL + '://' + runnableHostname.direct(opts) + this._defaultPort(instance)
    message += this._createMarkdownLink(instance.name, containerUrl)
    message += ' to '
    const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' + instance.name
    message += this._createMarkdownLink('your environment', instanceUrl)
    message += this._renderFooter(isolatedInstances)
    return message
  }

  _defaultPort (instance) {
    const ports = this._instancePorts(instance)
    if (ports.length > 0) {
      if (ports.indexOf('80') === -1) {
        return ':' + ports[0]
      }
    }
    return ''
  }

  _instancePorts (instance) {
    const portsObj = keypather.get(instance, 'containers[0].ports')
    if (!portsObj) {
      return []
    }
    return Object.keys(portsObj).map((port) => {
      return port.split('/')[0]
    })
  }

  _cleanupInstanceName (instanceName) {
    // if fullname prefixed by shortHash and -- we need to cleaned it up
    // drop only first `--`
    const fullName = instanceName
    const splitByPrefix = fullName.split('--')
    let shortName = splitByPrefix[0]
    if (splitByPrefix.length > 1) {
      splitByPrefix.shift()
      shortName = splitByPrefix.join('--')
    }
    return shortName
  }
  /**
   * Produce a markdown-formatted link
   * @param {String} link title
   * @param {String} link url
   * @return {String}
   */
  _createMarkdownLink (title, url) {
    return '[' + title + '](' + url + ')'
  }
}

module.exports = GitHubBot
module.exports._getGitHubToken = getToken
Promise.promisifyAll(GitHubBot.prototype)
