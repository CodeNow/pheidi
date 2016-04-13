/**
 * GitHub API request wrapper methods
 * @module lib/models/github
 */
'use strict'

const CriticalError = require('error-cat/errors/critical-error')
const Warning = require('error-cat/errors/warning')
var GithubApi = require('github')
var crypto = require('crypto')
var defaults = require('defaults')
var find = require('101/find')
var hasKeypaths = require('101/has-keypaths')
var util = require('util')

var log = require('logger').child({ module: 'github' })

module.exports = Github

function Github (opts) {
  opts = defaults(opts, {
    // required
    version: '3.0.0',
    // optional
    debug: false,
    protocol: 'https',
    requestMedia: 'application/json'
  })
  GithubApi.call(this, opts)
  if (opts.token) {
    this.token = opts.token
    var md5sum = crypto.createHash('md5')
    md5sum.update(opts.token)
    this.tokenHash = md5sum.digest('hex')
    this.authenticate({
      type: 'oauth',
      token: opts.token
    })
  }
}

util.inherits(Github, GithubApi)

Github.prototype.createDeployment = function (shortRepo, query, cb) {
  log.info({
    shortRepo: shortRepo,
    query: query
  }, 'createDeployment')
  var split = shortRepo.split('/')
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

Github.prototype.createDeploymentStatus = function (shortRepo, query, cb) {
  log.info({
    shortRepo: shortRepo,
    query: query
  }, 'createDeploymentStatus')
  var split = shortRepo.split('/')
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

Github.prototype.addComment = function (shortRepo, issueId, text, cb) {
  log.info({
    shortRepo: shortRepo,
    issueId: issueId,
    text: text
  }, 'addComment')
  var split = shortRepo.split('/')
  var query = {
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

Github.prototype.updateComment = function (shortRepo, commentId, text, cb) {
  log.info({
    shortRepo: shortRepo,
    commentId: commentId,
    text: text
  }, 'updateComment')
  var split = shortRepo.split('/')
  var query = {
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

Github.prototype.deleteComment = function (shortRepo, commentId, cb) {
  log.info({
    shortRepo: shortRepo,
    commentId: commentId
  }, 'deleteComment')
  var split = shortRepo.split('/')
  var query = {
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

Github.prototype.listComments = function (shortRepo, issueId, cb) {
  log.info({
    shortRepo: shortRepo,
    issueId: issueId
  }, 'listComments')
  var split = shortRepo.split('/')
  var query = {
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
    cb(null, comments)
  })
}

Github.prototype.findCommentByUser = function (shortRepo, issueId, githubUsername, cb) {
  log.info({
    shortRepo: shortRepo,
    issueId: issueId,
    githubUsername: githubUsername
  }, 'findCommentByUser')
  this.listComments(shortRepo, issueId, function (err, comments) {
    if (err) {
      return cb(err)
    }
    var comment = find(comments, hasKeypaths({ 'user.login': githubUsername }))
    cb(null, comment)
  })
}

Github.prototype.listOpenPullRequestsForBranch = function (shortRepo, branch, cb) {
  log.info({
    shortRepo: shortRepo,
    branch: branch
  }, 'listOpenPullRequestsForBranch')
  var split = shortRepo.split('/')
  var query = {
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
    prs = prs.filter(hasKeypaths({'head.ref': branch}))
    cb(null, prs)
  })
}

Github.prototype.getPullRequest = function (shortRepo, number, cb) {
  log.info({
    shortRepo: shortRepo,
    number: number
  }, 'listOpenPullRequestsForBranch')
  var split = shortRepo.split('/')
  var query = {
    user: split[0],
    repo: split[1],
    number: number
  }
  this.pullRequests.get(query, function (err, pr) {
    if (err) {
      err = (err.code === 404)
      ? new Warning('Cannot find PRs for ' + shortRepo, { err: err })
      : new CriticalError('Failed to get PR for ' + shortRepo, { err: err })
      return cb(err)
    }
    cb(null, pr)
  })
}

// Github.prototype.getPullRequestHeadCommit = function (shortRepo, number, cb) {
//   var self = this
//   this.getPullRequest(shortRepo, number, function (err, pr) {
//     if (err || !pr) { return cb(err) }
//     var commitId = pr.head.sha
//     self.getCommit(shortRepo, commitId, cb)
//   })
// }
