/**
 * GitHub API request wrapper methods
 * @module lib/models/github
 */
'use strict'

const CriticalError = require('error-cat/errors/critical-error')
const Warning = require('error-cat/errors/warning')
const GithubApi = require('github')
const crypto = require('crypto')
const defaults = require('defaults')
const find = require('101/find')
const hasKeypaths = require('101/has-keypaths')

const log = require('logger').child({ module: 'github' })

/**
 * GitHub client
 * @class
 */
class Github extends GithubApi {

  constructor (opts) {
    opts = defaults(opts, {
      // required
      version: '3.0.0',
      // optional
      debug: false,
      protocol: 'https',
      requestMedia: 'application/json'
    })
    super(opts)
    if (opts.token) {
      this.token = opts.token
      const md5sum = crypto.createHash('md5')
      md5sum.update(opts.token)
      this.tokenHash = md5sum.digest('hex')
      this.authenticate({
        type: 'oauth',
        token: opts.token
      })
    }
  }

  createDeployment (shortRepo, query, cb) {
    log.info({
      shortRepo: shortRepo,
      query: query
    }, 'createDeployment')
    const split = shortRepo.split('/')
    query.user = split[0]
    query.repo = split[1]
    this.repos.createDeployment(query, function (err, deployment) {
      if (err) {
        err = (err.code === 404)
          ? new Warning('Cannot find repo or ref: ' + shortRepo,
            { err: err, query: query })
          : new CriticalError('Failed to find repo or ref ' + shortRepo,
            { err: err, query: query })
        return cb(err)
      }
      cb(null, deployment)
    })
  }

  createDeploymentStatus (shortRepo, query, cb) {
    log.info({
      shortRepo: shortRepo,
      query: query
    }, 'createDeploymentStatus')
    const split = shortRepo.split('/')
    query.user = split[0]
    query.repo = split[1]
    this.repos.createDeploymentStatus(query, function (err, deployment) {
      if (err) {
        err = (err.code === 404)
          ? new Warning('Cannot find repo, ref or deployment: ' + shortRepo,
            { err: err, query: query })
          : new CriticalError('Failed to find repo, ref or deployment ' + shortRepo,
            { err: err, query: query })
        return cb(err)
      }
      cb(null, deployment)
    })
  }

  addComment (shortRepo, issueId, text, cb) {
    log.info({
      shortRepo: shortRepo,
      issueId: issueId,
      text: text
    }, 'addComment')
    const split = shortRepo.split('/')
    const query = {
      user: split[0],
      repo: split[1],
      number: issueId,
      body: text
    }
    this.issues.createComment(query, function (err, comment) {
      if (err) {
        err = (err.code === 404)
        ? new Warning('Issue ' + shortRepo + '/issues/' + issueId + ' not found.',
            { err: err })
        : new CriticalError('Failed to get issue comments ' + shortRepo + '/issues/' + issueId,
            { err: err })
        return cb(err)
      }
      cb(null, comment)
    })
  }

  updateComment (shortRepo, commentId, text, cb) {
    log.info({
      shortRepo: shortRepo,
      commentId: commentId,
      text: text
    }, 'updateComment')
    const split = shortRepo.split('/')
    const query = {
      user: split[0],
      repo: split[1],
      id: commentId,
      body: text
    }
    this.issues.editComment(query, function (err, comment) {
      if (err) {
        err = (err.code === 404)
        ? new Warning('Github comment ' + commentId + ' not found.', { err: err })
        : new CriticalError('Failed to update github comment id' + commentId, { err: err })
        return cb(err)
      }
      cb(null, comment)
    })
  }

  deleteComment (shortRepo, commentId, cb) {
    log.info({
      shortRepo: shortRepo,
      commentId: commentId
    }, 'deleteComment')
    const split = shortRepo.split('/')
    const query = {
      user: split[0],
      repo: split[1],
      id: commentId
    }
    this.issues.deleteComment(query, function (err) {
      if (err) {
        err = (err.code === 404)
        ? new Warning('Github comment ' + commentId + ' not found.', { err: err })
        : new CriticalError('Failed to delete github comment id' + commentId, { err: err })
        return cb(err)
      }
      return cb(null)
    })
  }

  listComments (shortRepo, issueId, cb) {
    log.info({
      shortRepo: shortRepo,
      issueId: issueId
    }, 'listComments')
    const split = shortRepo.split('/')
    const query = {
      user: split[0],
      repo: split[1],
      number: issueId
    }
    this.issues.getComments(query, function (err, comments) {
      if (err) {
        err = (err.code === 404)
        ? new Warning('Issue ' + shortRepo + '/issues/' + issueId + ' not found.', { err: err })
        : new CriticalError('Failed to get issue comments ' + shortRepo + '/issues/' + issueId,
            { err: err })
        return cb(err)
      }
      cb(null, comments || [])
    })
  }

  findCommentByUser (shortRepo, issueId, githubUsername, cb) {
    log.info({
      shortRepo: shortRepo,
      issueId: issueId,
      githubUsername: githubUsername
    }, 'findCommentByUser')
    this.listComments(shortRepo, issueId, function (err, comments) {
      if (err) {
        return cb(err)
      }
      const comment = find(comments, hasKeypaths({ 'user.login': githubUsername }))
      cb(null, comment)
    })
  }

  listOpenPullRequestsForBranch (shortRepo, branch, cb) {
    log.info({
      shortRepo: shortRepo,
      branch: branch
    }, 'listOpenPullRequestsForBranch')
    const split = shortRepo.split('/')
    const query = {
      user: split[0],
      repo: split[1],
      state: 'open',
      head: branch
    }
    this.pullRequests.getAll(query, function (err, prs) {
      if (err) {
        err = (err.code === 404)
        ? new Warning('Cannot find open PRs for ' + shortRepo + '@' + branch,
            { err: err })
        : new CriticalError('Failed to get PRs for ' + shortRepo + '@' + branch, { err: err })
        return cb(err)
      }
      // for some reason head branch filtering is not applied.
      // TODO check if this is problem with GitHub API or nodejs lib
      prs = (prs || []).filter(hasKeypaths({'head.ref': branch}))
      cb(null, prs)
    })
  }

  /**
   * User can have pending membership in the org:  e.x. invitation was sent but not accepted yet.
   * By setting `state` to `active` we are trying to accept membership.
   * @param {String} orgName accept runnabot invitation to the org
   * @param {Function} cb standard callback
   */
  acceptInvitation (orgName, cb) {
    log.info({
      orgName: orgName
    }, 'acceptInvitation')
    this.github.user.editOrganizationMembership({ org: orgName, state: 'active' },
      (err, resp) => {
        if (err) {
          err = (err.code === 404)
          ? new Warning('Cannot accept invitation for ' + orgName, { err: err })
          : new CriticalError('Failed to accept invitation for ' + orgName, { err: err })
          return cb(err)
        }
        cb(null, resp)
      })
  }

}

module.exports = Github
