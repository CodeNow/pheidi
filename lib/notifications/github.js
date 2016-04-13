'use strict'

const GitHubApi = require('models/github')

class GitHub {

  constructor () {
    this.github = new GitHubApi({ token: process.env.RUNNABOT_GITHUB_ACCESS_TOKEN })
  }

  upsertComment (gitInfo, instances, cb) {
    this.github.findCommentByUser(gitInfo.shortRepo, gitInfo.number,
      process.env.RUNNABOT_GITHUB_USERNAME,
      (err, comment) => {
        if (err) {
          return cb(err)
        }
        const newMessage = '' // self._renderMessage(gitInfo, instances)
        if (!comment) {
          return this.github.addComment(gitInfo.repo, gitInfo.number, newMessage, cb)
        }
        const oldMessage = comment.body
        if (newMessage === oldMessage) {
          return cb(null)
        }
        this.github.updateComment(gitInfo.shortRepo, comment.id, newMessage, cb)
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

module.exports = GitHub
