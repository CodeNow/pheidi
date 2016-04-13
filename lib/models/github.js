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

var log = require('logger').child({ module: 'github' })

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
      var md5sum = crypto.createHash('md5')
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

  createDeploymentStatus (shortRepo, query, cb) {
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
}

module.exports = Github
