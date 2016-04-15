'use strict'

const async = require('async')
const clone = require('101/clone')
const pluck = require('101/pluck')
const keypather = require('keypather')()
const runnableHostname = require('runnable-hostname')

const GitHub = require('models/github')
const logger = require('logger').child({ module: 'notifications/github-bot' })

// constant, key/val pair for query-string of generated links for GitHub runnabot
const REF_PR = 'ref=pr'

/**
 * Module that implements @runnabot - runnable GitHub bot that comments on customers PRs.
 * @class
 */
class GitHubBot {

  constructor () {
    this.github = new GitHub({ token: process.env.RUNNABOT_GITHUB_ACCESS_TOKEN })
  }

  /**
   * Notify all PR pages about instance deploy event.
   * First check if @runnabot is enabled and if it was invited into the org
   * @param {Object} pushInfo push info that has repo, branch, commit
   * @param {Object} instance instance for which event was received
   * @param {Function} cb - standard callback
   */
  notifyOnUpdate (pushInfo, instance, cb) {
    const log = logger.child({
      pushInfo: pushInfo,
      instance: instance,
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
      this._upsertComments(pushInfo, instance, cb)
    })
  }

  /**
   * Upsert (create new or update existing one) comment from runnabot on the corresponding PR.
   * @param {Object} gitInfo push info that has repo, branch, commit and PR number
   * @param {Object} instance instance for which event was received
   * @param {Function} cb - standard callback
   */
  _upsertComment (gitInfo, instance, cb) {
    const log = logger.child({
      gitInfo: gitInfo,
      instance: instance,
      method: 'upsertComment'
    })
    log.info('call')
    this.github.findCommentByUser(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comment) => {
        if (err) {
          log.error({ err: err }, 'error looking for a comment')
          return cb(err)
        }
        const newMessage = this._render(gitInfo, instance)
        if (!newMessage) {
          log.info('message is null, do not send anything')
          return cb(null)
        }
        if (!comment) {
          log.trace('creating new comment')
          return this.github.addComment(gitInfo.repo, gitInfo.number, newMessage, cb)
        }
        const oldMessage = comment.body
        if (newMessage === oldMessage) {
          log.trace('comment is the same. no change')
          return cb(null)
        }
        log.trace('update comment')
        this.github.updateComment(gitInfo.repo, comment.id, newMessage, cb)
      })
  }

  /**
   * Find all existing PRs based on the `pushInfo.repo` and `pushInfo.branch`.
   * For each found PR new comment should be upserted.
   * @param {Object} pushInfo push info that has repo, branch, commit
   * @param {Object} instance instance for which event was received
   * @param {Function} cb - standard callback
   */
  _upsertComments (pushInfo, instance, cb) {
    const log = logger.child({
      pushInfo: pushInfo,
      instance: instance,
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
        this._upsertComment(gitInfo, instance, callback)
      }, cb)
    })
  }

  _render (gitInfo, instance) {
    const opts = {
      shortHash: instance.shortHash,
      instanceName: instance.name,
      branch: gitInfo.branch,
      ownerUsername: instance.owner.username,
      masterPod: instance.masterPod,
      userContentDomain: process.env.USER_CONTENT_DOMAIN
    }
    const serverUrl = runnableHostname.direct(opts)
    var message = 'The latest push to PR-' + gitInfo.number
    if (gitInfo.state === 'failed') {
      message += ' has failed to build. Check out the logs '
      return message
    }
    if (gitInfo.state === 'building') {
      message += ' has building. Check out the logs '
      return message
    }
    if (gitInfo.state === 'running') {
      message += ' is running on ' + this._createServerLink(instance, serverUrl)
      return message
    }
    return null
  }

  _defaultPort (instance) {
    const ports = this._instancePorts(instance)
    if (ports.length > 0) {
      if (!ports.includes('80')) {
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
    return Object.keys(portsObj).map(function (port) {
      return port.split('/')[0]
    })
  }

  /**
   * Produce a markdown-formatted link & message
   * @param {Object} instance
   * @return {String}
   */
  _createServerLink (instance, link) {
    const url = 'http://' + link + this._defaultPort(instance) + '?' + REF_PR
    return this._createMarkdownLink(url, instance.name)
  }

  _createMarkdownLink (url, title) {
    return '[' + title + '](' + url + ')'
  }
}

module.exports = GitHubBot
