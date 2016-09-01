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
   * @param {Function} cb - standard callback
   */
  deleteBranchNotifications (pushInfo, cb) {
    const log = logger.child({
      pushInfo: pushInfo,
      method: 'deleteNotification'
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
        this._deleteComments(gitInfo, callback)
      }, cb)
    })
  }

  /**
   * Delete notifications for all PRs opened for the repo
   * @param {Object} pushInfo push info that has repo
   * @param {Function} cb - standard callback
   */
  deleteAllNotifications (pushInfo, cb) {
    const log = logger.child({
      pushInfo: pushInfo,
      method: 'deleteNotification'
    })
    log.info('call')
    this.github.listOpenPullRequests(pushInfo.repo, (err, prs) => {
      if (err) {
        log.error({ err: err }, 'find open prs')
        return cb(err)
      }
      log.trace({ prs: prs }, 'found prs')
      const ids = prs.map(pluck('number'))
      async.map(ids, (id, callback) => {
        const gitInfo = clone(pushInfo)
        gitInfo.number = id
        this._deleteComments(gitInfo, callback)
      }, cb)
    })
  }

  _deleteComments (gitInfo, cb) {
    const log = logger.child({
      gitInfo: gitInfo,
      method: '_deleteComments'
    })
    log.info('call')
    this.github.findCommentsByUser(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comments) => {
        if (err) {
          log.error({ err: err }, 'error looking for the comments')
          return cb(err)
        }
        async.each(comments, (comment, deleteCb) => {
          this.github.deleteComment(gitInfo.repo, comment.id, deleteCb)
        }, cb)
      })
  }

  /**
   * Ensure runnabot has no more than 1 comment on the PR page.
   * Duplicate comments can happen because of race condition - when we receive
   * two jobs
   * @param {Object} gitInfo push info that has repo, branch, commit and PR number
   * @param {Function} cb - standard callback
   */
  _ensureNoDuplicates (gitInfo, cb) {
    const log = logger.child({
      gitInfo: gitInfo,
      method: '_ensureNoDuplicates'
    })
    log.info('call')
    this.github.findCommentsByUser(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comments) => {
        if (err) {
          log.error({ err: err }, 'error looking for the comments')
          return cb(err)
        }
        if (comments.length > 1) {
          // remove top comment - which should still remain
          comments.pop()
          async.each(comments, (comment, deleteCb) => {
            this.github.deleteComment(gitInfo.repo, comment.id, deleteCb)
          }, cb)
        } else {
          return cb()
        }
      })
  }
  /**
   * Find comment that has link to the specified instance
   * @param {Array} array of github comments
   * @param {Object} instance object for which we are searching matching commentt
   * @return {Object} comment that was created for specific instance or undefined
   */
  _findCommentByInstance (comments, instance) {
    if (!comments || isEmpty(comments)) {
      return
    }
    return comments.find((comment) => {
      // if comment link has name of the instance we found appropriate comment
      return comment && comment.body && comment.body.includes(instance.name)
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
    const done = function (messageId, message) {
      return function (err, resp) {
        if (err) {
          tracker.del(messageId)
          return cb(err)
        }
        cb(err, resp)
      }
    }
    this.github.findCommentsByUser(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comments) => {
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
        const comment = this._findCommentByInstance(comments, instance)
        if (!comment) {
          log.trace('creating new comment')
          return this.github.addComment(gitInfo.repo, gitInfo.number, newMessage, done(messageId, newMessage))
        }
        const oldMessage = comment.body
        if (newMessage === oldMessage) {
          log.trace('comment is the same. no change')
          return cb(null)
        }
        log.trace('update comment')
        this.github.updateComment(gitInfo.repo, comment.id, newMessage, done(messageId, newMessage))
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

  _renderIsolatedInstance (isolatedInstances) {
    let message = ''
    if (isolatedInstances && !isEmpty(isolatedInstances)) {
      message += '<sub>Related containers:'
      const linksList = isolatedInstances.map((instance) => {
        const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' +
            instance.name
        const link = this._createServerLink(instance, instanceUrl)
        const statusIcon = this._renderStatusIcon(utils.instanceState(instance))
        return statusIcon + ' ' + link
      })
      message += linksList.join(' ')
      message += '</sub>'
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
    let message = ''

    message += 'Deployed '
    const statusIcon = this._renderStatusIcon(gitInfo.state)
    message += statusIcon
    const containerUrl = process.env.CONTAINER_URL_PROTOCOL + '://' + runnableHostname.direct(opts) + this._defaultPort(instance)
    message += this._createServerLink(instance, containerUrl)
    message += '  to '
    message += this._createServerLink(instance, containerUrl)
    const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' + instance.name
    message += this._createMarkdownLink(instanceUrl, 'your environment')
    message += '<sub>*From [Runnable](http://runnable.com)*</sub>'
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

  /**
   * Produce a markdown-formatted link & message
   * @param {Object} instance
   * @return {String}
   */
  _createServerLink (instance, link) {
    return this._createMarkdownLink(link, instance.name)
  }

  _createMarkdownLink (url, title) {
    return '[' + title + '](' + url + ')'
  }
}

module.exports = GitHubBot
module.exports._getGitHubToken = getToken
Promise.promisifyAll(GitHubBot.prototype)
