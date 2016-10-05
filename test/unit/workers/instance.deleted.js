/**
 * @module unit/workers/instance.deleted
 */
'use strict'

const Promise = require('bluebird')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const AccessDeniedError = require('models/access-denied-error')
const RateLimitedError = require('models/rate-limited-error')
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const GitHubBot = require('notifications/github.bot')
const Worker = require('workers/instance.deleted').task

describe('Instance Deleted Worker', function () {
  describe('worker', function () {
    describe('regular flow', function () {
      beforeEach(function (done) {
        sinon.stub(GitHubBot.prototype, 'deleteBranchNotificationsAsync').returns()
        sinon.stub(GitHubBot.prototype, 'deleteAllNotificationsAsync').returns()
        done()
      })

      afterEach(function (done) {
        GitHubBot.prototype.deleteBranchNotificationsAsync.restore()
        GitHubBot.prototype.deleteAllNotificationsAsync.restore()
        done()
      })

      it('should do nothing if testing instance', function (done) {
        const instance = {
          isTesting: true,
          owner: {
            github: 2828361
          },
          contextVersion: {
            appCodeVersions: [
              {
                repo: 'CodeNow/api',
                branch: 'feature1'
              }
            ]
          }
        }
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.deleteBranchNotificationsAsync)
          sinon.assert.notCalled(GitHubBot.prototype.deleteAllNotificationsAsync)
          done()
        })
      })

      it('should do nothing if org was not whitelisted', function (done) {
        const instance = {
          owner: {
            github: 213123123123123
          },
          contextVersion: {
            appCodeVersions: [
              {
                repo: 'CodeNow/api',
                branch: 'feature1'
              }
            ]
          }
        }
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.deleteBranchNotificationsAsync)
          sinon.assert.notCalled(GitHubBot.prototype.deleteAllNotificationsAsync)
          done()
        })
      })

      it('should do nothing if no acv was found', function (done) {
        const instance = {
          owner: {
            github: 2828361
          },
          contextVersion: {
            appCodeVersions: [
              {
                repo: 'CodeNow/api',
                branch: 'feature1',
                additionalRepo: true
              }
            ]
          }
        }
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.deleteBranchNotificationsAsync)
          sinon.assert.notCalled(GitHubBot.prototype.deleteAllNotificationsAsync)
          done()
        })
      })

      describe('non master instance', function () {
        it('should fail if deleteBranchNotificationsAsync', function (done) {
          const githubError = new Error('GitHub error')
          GitHubBot.prototype.deleteBranchNotificationsAsync.rejects(githubError)
          const instance = {
            owner: {
              github: 2828361,
              username: 'Runnable'
            },
            contextVersion: {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          }
          Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err.message, githubError.message)
            done()
          })
        })

        it('should call deleteBranchNotificationsAsync', function (done) {
          const instance = {
            id: '57153cef3f41b71d004e7c27',
            owner: {
              github: 2828361,
              username: 'Runnable'
            },
            contextVersion: {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          }
          Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
            assert.isNull(err)
            sinon.assert.calledOnce(GitHubBot.prototype.deleteBranchNotificationsAsync)
            sinon.assert.calledWith(GitHubBot.prototype.deleteBranchNotificationsAsync,
              { repo: 'CodeNow/api',
                branch: 'feature1'
              })
            done()
          })
        })
      })

      describe('master instance', function () {
        it('should fail if deleteAllNotificationsAsync failed', function (done) {
          const githubError = new Error('GitHub error')
          GitHubBot.prototype.deleteAllNotificationsAsync.rejects(githubError)
          const instance = {
            owner: {
              github: 2828361,
              username: 'Runnable'
            },
            masterPod: true,
            contextVersion: {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          }
          Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err.message, githubError.message)
            done()
          })
        })

        it('should return WorkerStopError if runnabot has no org access', function (done) {
          const githubError = new AccessDeniedError('No org access for runnabot')
          GitHubBot.prototype.deleteAllNotificationsAsync.rejects(githubError)
          const instance = {
            owner: {
              github: 2828361,
              username: 'Runnable'
            },
            masterPod: true,
            contextVersion: {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          }
          Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
            assert.isDefined(err)
            assert.match(err.message, /Runnabot has no access to an org/)
            assert.instanceOf(err, WorkerStopError)
            done()
          })
        })

        it('should return WorkerStopError if runnabot has reached rate limit', function (done) {
          const githubError = new RateLimitedError('Runnabot has reached rate-limit')
          GitHubBot.prototype.deleteAllNotificationsAsync.rejects(githubError)
          const instance = {
            owner: {
              github: 2828361,
              username: 'Runnable'
            },
            masterPod: true,
            contextVersion: {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          }
          Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
            assert.isDefined(err)
            assert.match(err.message, /Runnabot has reached rate-limit/)
            assert.instanceOf(err, WorkerStopError)
            done()
          })
        })

        it('should call deleteAllNotificationsAsync', function (done) {
          const instance = {
            id: '57153cef3f41b71d004e7c27',
            masterPod: true,
            owner: {
              github: 2828361,
              username: 'Runnable'
            },
            contextVersion: {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          }
          Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
            assert.isNull(err)
            sinon.assert.calledOnce(GitHubBot.prototype.deleteAllNotificationsAsync)
            sinon.assert.calledWith(GitHubBot.prototype.deleteAllNotificationsAsync,
              { repo: 'CodeNow/api',
                branch: 'feature1'
              })
            done()
          })
        })
      })
    })
  })
})
