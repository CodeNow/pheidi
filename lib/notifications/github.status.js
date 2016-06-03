'use strict'

const BaseError = require('error-cat/errors/base-error')
const Github = require('models/github')
const keypather = require('keypather')()
const logger = require('logger')
const mongodbHelper = require('mongo-helper')
const Promise = require('bluebird')

const descriptions = {
  pending: 'Tests are running',
  success: 'Tests completed successfully',
  error: 'Tests did not pass',
  failure: 'Build failure'
}

class PreconditionError extends BaseError { }
class FatalGithubError extends BaseError { }

/**
 * Module that is responsible for creating GitHub statuses
 * @class
 */
class GithubStatus {
  setStatus (instance, mainAcv, state, customDescription) {
    const log = logger.child({
      module: 'GithubStatus.setStatus',
      state: state,
      instanceId: instance._id,
      instanceName: instance.name,
      repo: mainAcv.lowerRepo.split('/')[1],
      user: mainAcv.lowerRepo.split('/')[0],
      sha: mainAcv.commit
    })
    log.info('called')
    // Find the user who made the last commit on this ACV and get their token, use this token to make the request.
    return Promise.try(() => {
      const createdBy = keypather.get(instance, 'contextVersion.createdBy.github')
      if (!createdBy) {
        throw new PreconditionError('Context Version is missing createdBy github')
      }
      return createdBy
    })
      .then((createdBy) => {
        return Promise.using(mongodbHelper.helper(), (mongoClient) => {
          return mongoClient.findOneUserAsync({
            'accounts.github.id': createdBy
          })
        })
      })
      .tap((user) => {
        if (!user) {
          throw new PreconditionError('No user in runnable with createdBy id', {
            githubId: keypather.get(instance, 'contextVersion.createdBy.github')
          })
        }
        if (!keypather.get(user, 'accounts.github.accessToken')) {
          throw new PreconditionError('Runnable user does not have accessToken', {
            user: user
          })
        }
      })
      .then((user) => {
        return new Github({ token: keypather.get(user, 'accounts.github.accessToken') })
      })
      .then((github) => {
        return github.createStatus(instance, mainAcv, state, customDescription || descriptions[state])
          .catch((err) => {
            throw new FatalGithubError(err.message, {
              originalError: err
            })
          })
      })
  }
}

module.exports = GithubStatus
module.exports.PreconditionError = PreconditionError
module.exports.FatalGithubError = FatalGithubError
