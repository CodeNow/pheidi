/**
 * @module unit/workers/instance.deployed
 */
'use strict'

const Promise = require('bluebird')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const AccessDeniedError = require('models/access-denied-error')
const Mongo = require('models/mongo')
const RateLimitedError = require('models/rate-limited-error')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const GitHubBot = require('notifications/github.bot')
const Worker = require('workers/github.bot.notify').task

describe('GitHub Bot Notify Worker', function () {
  describe('worker', function () {
    beforeEach(function (done) {
      sinon.stub(Mongo.prototype, 'connect').yieldsAsync()
      sinon.stub(Mongo.prototype, 'close').yieldsAsync()
      sinon.stub(Mongo.prototype, 'findInstancesAsync').resolves([])
      done()
    })
    afterEach(function (done) {
      Mongo.prototype.connect.restore()
      Mongo.prototype.close.restore()
      Mongo.prototype.findInstancesAsync.restore()
      done()
    })
    describe('regular flow', function () {
      beforeEach(function (done) {
        sinon.stub(GitHubBot.prototype, 'notifyOnUpdateAsync').resolves()
        done()
      })

      afterEach(function (done) {
        GitHubBot.prototype.notifyOnUpdateAsync.restore()
        done()
      })

      it('should fail if githubBot.notifyOnUpdate failed', function (done) {
        const githubError = new Error('GitHub error')
        GitHubBot.prototype.notifyOnUpdateAsync.rejects(githubError)
        const instance = {
          owner: {
            github: 2828361,
            username: 'Runnable'
          },
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ],
              build: {
                failed: true
              }
            }
          ]
        }
        const pushInfo = {
          repo: 'CodeNow/api',
          branch: 'f1',
          state: 'running'
        }
        Worker({ instance: instance, pushInfo: pushInfo }).asCallback(function (err) {
          assert.isDefined(err)
          assert.equal(err.message, githubError.message)
          done()
        })
      })

      it('should return WorkerStopError if runnabot has no org access', function (done) {
        const githubError = new AccessDeniedError('No org access for runnabot')
        GitHubBot.prototype.notifyOnUpdateAsync.rejects(githubError)
        const instance = {
          owner: {
            github: 2828361,
            username: 'Runnable'
          },
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ],
              build: {
                failed: true
              }
            }
          ]
        }
        const pushInfo = {
          repo: 'CodeNow/api',
          branch: 'f1',
          state: 'running'
        }
        Worker({ instance: instance, pushInfo: pushInfo }).asCallback(function (err) {
          assert.isDefined(err)
          assert.match(err.message, /Runnabot has no access to an org/)
          assert.instanceOf(err, WorkerStopError)
          done()
        })
      })

      it('should return WorkerStopError if runnabot has reached rate limit', function (done) {
        const githubError = new RateLimitedError('Runnabot has reached rate-limit')
        GitHubBot.prototype.notifyOnUpdateAsync.rejects(githubError)
        const instance = {
          owner: {
            github: 2828361,
            username: 'Runnable'
          },
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ],
              build: {
                failed: true
              }
            }
          ]
        }
        const pushInfo = {
          repo: 'CodeNow/api',
          branch: 'f1',
          state: 'running'
        }
        Worker({ instance: instance, pushInfo: pushInfo }).asCallback(function (err) {
          assert.isDefined(err)
          assert.match(err.message, /Runnabot has reached rate-limit/)
          assert.instanceOf(err, WorkerStopError)
          done()
        })
      })

      it('should call githubBot.notifyOnUpdate', function (done) {
        const instance = {
          id: '57153cef3f41b71d004e7c27',
          owner: {
            github: 2828361,
            username: 'Runnable'
          },
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ],
              build: {
                failed: true
              }
            }
          ]
        }
        const pushInfo = {
          repo: 'CodeNow/api',
          branch: 'feature1',
          state: 'running'
        }
        Worker({ instance: instance, pushInfo: pushInfo }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHubBot.prototype.notifyOnUpdateAsync)
          sinon.assert.calledWith(GitHubBot.prototype.notifyOnUpdateAsync, pushInfo, instance)
          done()
        })
      })
    })
  })
})
