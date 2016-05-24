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
const Worker = require('workers/instance.deleted')

describe('Instance Updated Worker', function () {
  describe('worker', function () {
    describe('invalid Job', function () {
      it('should throw a task fatal error if the job is missing entirely', function (done) {
        Worker().asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /job.+required/i)
          done()
        })
      })

      it('should throw a task fatal error if the job is not an object', function (done) {
        Worker(true).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /must be an object/i)
          done()
        })
      })

      it('should throw a task fatal error if the job is missing a instance', function (done) {
        Worker({}).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /instance.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance is not an object', function (done) {
        Worker({ instance: 1 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /instance.*object/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance owner is not defined', function (done) {
        Worker({ instance: {} }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /owner.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance owner.github is not defined', function (done) {
        Worker({ instance: { owner: {} } }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /github.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance owner.github is not a number', function (done) {
        const payload = {
          instance:
          {
            owner: {
              github: 'anton'
            }
          }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /github.*number/i)
          done()
        })
      })

      it('should throw a task fatal error if the contextVersions is not defined', function (done) {
        const payload = {
          instance:
          {
            owner: {
              github: 1
            }
          }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /contextVersions.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the contextVersions is not an array', function (done) {
        const payload = {
          instance:
          {
            owner: {
              github: 1
            },
            contextVersions: {}
          }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /contextVersions.*array/i)
          done()
        })
      })

      it('should throw a task fatal error if the contextVersion is not an object', function (done) {
        const payload = {
          instance:
          {
            owner: {
              github: 1
            },
            contextVersions: [1]
          }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /context version.*must be an object/i)
          done()
        })
      })
    })
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

      it('should do nothing if org was not whitelisted', function (done) {
        const instance = {
          owner: {
            github: 213123123123123
          },
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ]
            }
          ]
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
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1',
                  additionalRepo: true
                }
              ]
            }
          ]
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
            contextVersions: [
              {
                appCodeVersions: [
                  {
                    repo: 'CodeNow/api',
                    branch: 'feature1'
                  }
                ]
              }
            ]
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
            contextVersions: [
              {
                appCodeVersions: [
                  {
                    repo: 'CodeNow/api',
                    branch: 'feature1'
                  }
                ]
              }
            ]
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
            contextVersions: [
              {
                appCodeVersions: [
                  {
                    repo: 'CodeNow/api',
                    branch: 'feature1'
                  }
                ]
              }
            ]
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
            contextVersions: [
              {
                appCodeVersions: [
                  {
                    repo: 'CodeNow/api',
                    branch: 'feature1'
                  }
                ]
              }
            ]
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
            contextVersions: [
              {
                appCodeVersions: [
                  {
                    repo: 'CodeNow/api',
                    branch: 'feature1'
                  }
                ]
              }
            ]
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
            contextVersions: [
              {
                appCodeVersions: [
                  {
                    repo: 'CodeNow/api',
                    branch: 'feature1'
                  }
                ]
              }
            ]
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
