'use strict'

const Promise = require('bluebird')
const async = require('async')
const bigPoppa = require('models/big-poppa')
const clone = require('101/clone')
const isEmpty = require('101/is-empty')
const isString = require('101/is-string')
const pluck = require('101/pluck')
const rabbitmq = require('rabbitmq')
const GitHub = require('models/github')
const GitHubBotMessage = require('notifications/github.bot.message')
const InvalidStatusError = require('models/invalid-status-error')
const PrAccessDeniedError = require('models/pr-access-denied-error')
const tracker = require('models/tracker')
const keypather = require('keypather')()
const logger = require('logger').child({ module: 'notifications/github-bot' })

/**
 * Module that implements @runnabot - runnable GitHub bot that comments on customers PRs.
 * @class
 */
class GitHubBot {

  constructor () {
    this.github = new GitHub({ token: GitHubBot.getToken() })
  }

  static getToken () {
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
   * Checks the runnabotEnabled flag for a given org.  If it's not set, it throws a
   * PrAccessDeniedError error
   *
   * @param {String}   orgName - name of the org to check
   * @returns {Promise}
   * @resolves {Org} - Org model from bigPoppa
   *
   * @throws PrAccessDeniedError - When the org doesn't have PR bot enabled
   */
  checkPrBotEnabled (orgName) {
    const log = logger.child({
      orgName: orgName,
      method: 'checkPrBotEnabledAndAcceptInvite'
    })
    log.info('checkPrBotEnabledAndAcceptInvite called')
    return bigPoppa.getOrganizations({ lowerName: orgName.toLowerCase() })
      .get('0')
      .tap((org) => {
        log.info({ org: org }, 'received org')
        if (!org.prBotEnabled) {
          throw new PrAccessDeniedError('Org does not allow PR bot', { org })
        }
      })
  }

  /**
   * Checks the runnabotEnabled flag for a given org.  If it's not set, it attempts to accept org invites from the org.
   * If it is successful, it creates a job to update the value in BigPoppa
   *
   * @param {String}   orgName - name of the org to check
   * @returns {Promise}   *
   */
  checkPrBotEnabledAndAcceptInvite (orgName) {
    const log = logger.child({
      orgName: orgName,
      method: 'checkPrBotEnabledAndAcceptInvite'
    })
    log.info('checkPrBotEnabledAndAcceptInvite called')
    return bigPoppa.getOrganizations({ lowerName: orgName.toLowerCase() })
      .get('0')
      .then((org) => {
        log.info({ org: org }, 'received org')
        if (!org.prBotEnabled) {
          log.info('prBotEnabled not set, accepting invitation')
          return this.github.acceptInvitationAsync(orgName)
            .then(function () {
              rabbitmq.publishPrBotEnabled({
                organization: {
                  id: org.id
                }
              })
            })
            .catch((err) => {
              log.error({ err: err }, 'runnabot is not a member of an org')
              throw err
            })
        }
      })
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
    this.checkPrBotEnabledAndAcceptInvite(instance.owner.username)
      .then(() => {
        return Promise.fromCallback((done) => {
          this._upsertComments(pushInfo, instance, isolatedInstances, done)
        })
      })
      .asCallback(cb)
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
          log.error({ err }, 'error looking for comments to delete')
          return cb(err)
        }
        async.each(comments, (comment, deleteCb) => {
          this.github.deleteComment(gitInfo.repo, comment.id, deleteCb)
        }, cb)
      })
  }

  /**
   * Ensure runnabot has no more than 1 comment on the PR page per clusterId
   * Duplicate comments can happen because of race condition - when we receive
   * two jobs
   * @param {Object} gitInfo push info that has repo, branch, commit and PR number
   * @param {Array[]} comments array of comments by user from a pull request
   * @param {Function} cb - standard callback
   */
  _ensureNoDuplicates (gitInfo, cb) {
    const log = logger.child({
      gitInfo: gitInfo,
      method: '_ensureNoDuplicates'
    })
    log.info('call')
    const htmlCommentRegEx = /<!-- ([\S]*?) -->\n/
    this.github.findCommentsByUser(gitInfo.repo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comments) => {
        if (err) {
          log.error({ err }, 'error looking for the comments')
          return cb(err)
        }
        if (comments.length > 1) {
          let clusterIds = []
          let commentsToDelete = comments.filter((comment) => {
            let parseCommentForClusterID = htmlCommentRegEx.exec(comment.body)
            if (parseCommentForClusterID) {
              let clusterId = parseCommentForClusterID[1]
              if (clusterIds.indexOf(clusterId) !== -1) {
                clusterIds.push(clusterId)
                return false
              }
            }
            comments.pop()
            return true
          })
          async.each(commentsToDelete, (comment, deleteCb) => {
            log.info('Deleting ')
            this.github.deleteComment(gitInfo.repo, comment.id, deleteCb)
          }, cb)
        } else {
          return cb()
        }
      })
  }

  /**
   * Find comment that has link to the desired cluster ID
   * @param {Array} array of github comments
   * @param {String} clusterId to match comment with
   * @return {Object} comment that was created for specific instance or undefined
   */
  _findCommentByClusterId (comments, clusterId) {
    if (!comments || isEmpty(comments)) {
      return
    }
    return comments.find((comment) => {
      // if comment link has name of the instance we found appropriate comment
      return comment && comment.body && comment.body.includes(clusterId)
    })
  }

  /**
   * Upsert (create new or update existing one) comment from runnabot on the corresponding PR.
   * @param {Object} gitInfo push info that has repo, branch, commit and PR number
   * @param {Object} instance instance for which event was received
   * @param {Array} isolatedInstances array of isolated instances if any
   * @param {Function} cb - standard callback
   * @throws InvalidStatusError - When the instance is running, but we're missing the container object
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
    if (gitInfo.state === 'running' && !keypather.get(instance, 'containers.length') && !keypather.get(instance, 'container')) {
      log.info('Could not find the container on the instance')
      return cb(new InvalidStatusError('The instance is missing the container!  Can\'t update github'), { instance })
    }
    this.github.findCommentsByUser(gitInfo.repo, gitInfo.number, process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comments) => {
        if (err) {
          log.error({ err }, 'error looking for a comment')
          return cb(err)
        }
        const newMessage = GitHubBotMessage.render(gitInfo, instance, isolatedInstances)
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
        const clusterId = instance.inputClusterConfig ? instance.inputClusterConfig._id : 'noClusterId'
        const comment = this._findCommentByClusterId(comments, clusterId)
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
        this._ensureNoDuplicates(gitInfo, () => {
          this._upsertComment(gitInfo, instance, isolatedInstances, callback)
        })
      }, cb)
    })
  }
}

module.exports = GitHubBot
Promise.promisifyAll(GitHubBot.prototype)
