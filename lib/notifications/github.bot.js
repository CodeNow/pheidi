'use strict'

const async = require('async')
const clone = require('101/clone')
const pluck = require('101/pluck')

const GitHub = require('models/github')
const logger = require('logger').child({ module: 'notifications/github-bot' })

class GitHubBot {

  constructor () {
    this.github = new GitHub({ token: process.env.RUNNABOT_GITHUB_ACCESS_TOKEN })
  }

  upsertComment (gitInfo, instance, cb) {
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
        const newMessage = 'Deployed' // self._renderMessage(gitInfo, instances)
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

  upsertComments (pushInfo, instance, cb) {
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
        gitInfo.owner = {
          username: instance.owner.username
        }
        gitInfo.number = id
        this.upsertComment(gitInfo, instance, callback)
      }, cb)
    })
  }

  /**
   * User can have pending membership in the org:  e.x. invitation was sent but not accepted yet.
   * By setting `state` to `active` we are trying to accept membership.
   */
  acceptInvitation (orgName, cb) {
    this.github.user.editOrganizationMembership({ org: orgName, state: 'active' }, cb)
  }
}

module.exports = GitHubBot
