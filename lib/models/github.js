/**
 * GitHub API request wrapper methods
 * @module lib/models/github
 */
'use strict'

const AccessDeniedError = require('models/access-denied-error')
const CriticalError = require('error-cat/errors/critical-error')
const crypto = require('crypto')
const defaults = require('defaults')
const GithubApi = require('github4')
const hasKeypaths = require('101/has-keypaths')
const keypather = require('keypather')()
const Promise = require('bluebird')
const RateLimitedError = require('models/rate-limited-error')

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
      protocol: process.env.GITHUB_PROTOCOL,
      host: process.env.GITHUB_VARNISH_HOST,
      port: process.env.GITHUB_VARNISH_PORT,
      requestMedia: 'application/json',
      headers: {
        'user-agent': 'pheidi.runnable.com' // GitHub is happy with a unique user agent
      }
    })
    log.trace({opts: opts}, 'Setup errything')
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
    const query = { id: githubId }
    this.users.getById(query,
      this._handleResponse(
        'Failed to find user',
        query, undefined, cb))
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
    this.issues.createComment(query,
      this._handleResponse(
        'Failed to create github comment',
        query, undefined, cb))
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
    this.issues.editComment(query,
      this._handleResponse(
        'Failed to update github comment',
        query, undefined, cb))
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
    this.issues.deleteComment(query,
      this._handleResponse(
        'Failed to delete github comment',
        query, undefined, cb))
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
    this.issues.getComments(query,
      this._handleResponse(
        'Failed to get issue comments',
        query, [], cb))
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
   * Find open PRs for the repo
   * @param {String} shortRepo repo name in the format `CodeNow/api`
   * @param {Function} cb standard callback
   */
  listOpenPullRequests (shortRepo, cb) {
    log.info({
      shortRepo: shortRepo
    }, 'listOpenPullRequests')
    const split = shortRepo.split('/')
    const query = {
      user: split[0],
      repo: split[1],
      state: 'open'
    }
    log.trace({ query }, 'Query for pull requests')
    this.pullRequests.getAll(query,
      this._handleResponse(
        'Failed to get PRs',
        query, [], cb))
  }

  /**
   * Find open PRs for the repo and branch
   * @param {String} shortRepo repo name in the format `CodeNow/api`
   * @param {String} branch branch name
   * @param {Function} cb standard callback
   */
  listOpenPullRequestsForBranch (shortRepo, branch, cb) {
    log.info({
      shortRepo: shortRepo,
      branch: branch
    }, 'listOpenPullRequestsForBranch')
    this.listOpenPullRequests(shortRepo, function (err, prs) {
      if (err) {
        return cb(err)
      }
      prs = prs.filter(hasKeypaths({ 'head.ref': branch }))
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
    this.users.editOrganizationMembership({ org: orgName, state: 'active' },
      this._handleResponse(
        'Failed to accept invitation',
        { orgName: orgName }, undefined, cb))
  }

  _handleResponse (msg, query, defaultResponse, cb) {
    return (err, resp) => {
      if (err) {
        const errData = {
          err: err,
          query: query
        }
        log.error({err: err, code: err.code}, 'Request failed')
        if (err.code === 404) {
          return cb(new AccessDeniedError(msg, errData))
        }
        if (err.code === 403) {
          return cb(new RateLimitedError(msg, errData))
        }
        return cb(new CriticalError(msg, errData))
      }
      cb(null, resp || defaultResponse)
    }
  }
  /**
   * Set the status of a particular commit inside github
   * @param {Object} instance - Instance object
   * @param {Object} mainAcv - App code version for what we'd like to report status for
   * @param {String} status - String status
   * @param {String} description - String description
   * @param {String} contextName - String name of the context (should be the masterpod's name)
   * @returns {Promise}
   * @resolves {undefined} - Resolves no value
   */
  createStatus (instance, mainAcv, status, description, contextName) {
    return Promise.fromCallback((cb) => {
      this.repos.createStatus({
        user: mainAcv.lowerRepo.split('/')[0],
        repo: mainAcv.lowerRepo.split('/')[1],
        sha: mainAcv.commit,
        state: status,
        target_url: createTargetUrl(instance),
        description: description,
        context: 'runnable/' + contextName
      }, cb)
    })
      .return()
  }
}

function createTargetUrl (instance) {
  const owner = keypather.get(instance, 'owner.username')
  return process.env.WEB_URL + '/' + owner + '/' + instance.name
}

Promise.promisifyAll(Github.prototype)

module.exports = Github
