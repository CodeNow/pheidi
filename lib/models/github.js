/**
 * GitHub API request wrapper methods
 * @module lib/models/github
 */
'use strict'

const Promise = require('bluebird')
const CriticalError = require('error-cat/errors/critical-error')
const Warning = require('error-cat/errors/warning')
const AccessDeniedError = require('models/access-denied-error')
const RateLimitedError = require('models/rate-limited-error')
const GithubApi = require('github4')
const crypto = require('crypto')
const defaults = require('defaults')
const hasKeypaths = require('101/has-keypaths')

const log = require('logger').child({ module: 'github' })

/**
 * GitHub client
 * @class
 */
class Github extends GithubApi {

  constructor (opts) {
    opts = defaults(opts, {
      // optional
      debug: false,
      protocol: 'https',
      requestMedia: 'application/json',
      headers: {
        'user-agent': 'pheidi.runnable.com' // GitHub is happy with a unique user agent
      }
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

  getUserById (githubId, cb) {
    log.info({
      githubId: githubId
    }, 'getUserById')
    this.user.getById(githubId, function (err, user) {
      if (err) {
        const errData = {
          err: err,
          githubId: githubId
        }
        if (err.code === 404) {
          return cb(new AccessDeniedError('Failed to find user', errData))
        }
        if (err.code === 403) {
          return cb(new RateLimitedError('Cannot find user', errData))
        }
        return cb(new CriticalError('Failed to find user', errData))
      }
      cb(null, user)
    })
  }

  /**
   * Create new GitHub deployment
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Object} query data for the deployment
   * @param {Function} cb standard callback
   */
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

  /**
   * Create new GitHub deployment status
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Object} query data for the deployment
   * @param {Function} cb standard callback
   */
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

  /**
   * Create new comment for the issue/PR
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Number} issueId id of the issue that should have new comment
   * @param {String} text text for the comment in the markdown
   * @param {Function} cb standard callback
   */
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

  /**
   * Update comment with the new text
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Number} commentId id of the comment to be updated
   * @param {String} text new text for the comment in the markdown
   * @param {Function} cb standard callback
   */
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

  /**
   * Delete comment by id
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Number} commentId id of the comment to be deleted
   * @param {Function} cb standard callback
   */
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

  /**
   * Find comments on the issue/PR
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Number} issueId id of the issue/PR
   * @param {Function} cb standard callback
   */
  _listComments (shortRepo, issueId, cb) {
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

  /**
   * Find comments on the issue/PR by `githubUsername`
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Number} issueId id of the issue/PR
   * @param {githubUsername} github username used to search for a commit
   * @param {Function} cb standard callback
   */
  findCommentsByUser (shortRepo, issueId, githubUsername, cb) {
    log.info({
      shortRepo: shortRepo,
      issueId: issueId,
      githubUsername: githubUsername
    }, 'findCommentsByUser')
    this._listComments(shortRepo, issueId, function (err, comments) {
      if (err) {
        return cb(err)
      }
      const userComments = comments.filter(hasKeypaths({ 'user.login': githubUsername }))
      cb(null, userComments || [])
    })
  }

  /**
   * Find comment on the issue/PR by `githubUsername`
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {Number} issueId id of the issue/PR
   * @param {githubUsername} github username used to search for a commit
   * @param {Function} cb standard callback
   */
  findCommentByUser (shortRepo, issueId, githubUsername, cb) {
    log.info({
      shortRepo: shortRepo,
      issueId: issueId,
      githubUsername: githubUsername
    }, 'findCommentByUser')
    this.findCommentsByUser(shortRepo, issueId, githubUsername, function (err, comments) {
      if (err) {
        return cb(err)
      }
      const comment = comments[0]
      cb(null, comment)
    })
  }

  /**
   * Find open PRs for the repo and branch
   * @param {String} shortRepo repo name is the format `CodeNow/api`
   * @param {String} branch branch name
   * @param {Function} cb standard callback
   */
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
        if (err.code === 404) {
          return cb(new AccessDeniedError('Cannot find open PRs for ' + shortRepo + '@' + branch, { err: err }))
        }
        if (err.code === 403) {
          return cb(new RateLimitedError('Cannot find open PRs for ' + shortRepo + '@' + branch, { err: err }))
        }
        return cb(new CriticalError('Failed to get PRs for ' + shortRepo + '@' + branch, { err: err }))
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
    this.user.editOrganizationMembership({ org: orgName, state: 'active' }, (err, resp) => {
      if (err) {
        if (err.code === 404) {
          return cb(new AccessDeniedError('Cannot accept invitation for ' + orgName, { err: err }))
        }
        if (err.code === 403) {
          return cb(new RateLimitedError('Cannot accept invitation for ' + orgName, { err: err }))
        }
        return cb(new CriticalError('Failed to accept invitation for ' + orgName, { err: err }))
      }
      cb(null, resp)
    })
  }

}

Promise.promisifyAll(Github.prototype)

module.exports = Github
