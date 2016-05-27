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
const TaskFatalError = require('ponos').TaskFatalError
const GitHubBot = require('notifications/github.bot')
const Worker = require('workers/github.bot.notify')

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
    describe('invalid Job', function () {
      it('should throw a task fatal error if the job is missing entirely', function (done) {
        Worker().asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /job.+required/i)
          done()
        })
      })

      it('should throw a task fatal error if the job is not an object', function (done) {
        Worker(true).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /must be an object/i)
          done()
        })
      })

      it('should throw a task fatal error if the job is missing a pushInfo', function (done) {
        Worker({}).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /pushInfo.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo is not an object', function (done) {
        Worker({ pushInfo: 1 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /pushInfo.*object/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo.repo is not defined', function (done) {
        Worker({ pushInfo: {} }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /repo.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo.repo is not a string', function (done) {
        Worker({ pushInfo: { repo: 1 } }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /repo.*must be a string/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo.branch is not defined', function (done) {
        Worker({ pushInfo: { repo: 'CodeNow/api' } }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /branch.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo.branch is not a string', function (done) {
        Worker({ pushInfo: { repo: 'CodeNow/api', branch: 1 } }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /branch.*must be a string/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo.state is not defined', function (done) {
        Worker({ pushInfo: { repo: 'CodeNow/api', branch: 'f1' } }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /state.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the pushInfo.state is not a string', function (done) {
        Worker({ pushInfo: { repo: 'CodeNow/api', branch: 'f1', state: 1 } }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /state.*must be a string/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance is not an object', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
          instance: 1
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /instance.*object/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance owner is not defined', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
          instance: {}
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /owner.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance owner.github is not defined', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
          instance: { owner: {} }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /github.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance owner.github is not a number', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
          instance:
          {
            owner: {
              github: 'anton'
            }
          }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /github.*number/i)
          done()
        })
      })

      it('should throw a task fatal error if the contextVersions is not defined', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
          instance:
          {
            owner: {
              github: 1
            }
          }
        }
        Worker(payload).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /contextVersions.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the contextVersions is not an array', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
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
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /contextVersions.*array/i)
          done()
        })
      })

      it('should throw a task fatal error if the contextVersion is not an object', function (done) {
        const payload = {
          pushInfo: {
            repo: 'CodeNow/api',
            branch: 'f1',
            state: 'running'
          },
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
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /context version.*must be an object/i)
          done()
        })
      })
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

      it('should return TaskFatalError if runnabot has no org access', function (done) {
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
          assert.instanceOf(err, TaskFatalError)
          done()
        })
      })

      it('should return TaskFatalError if runnabot has reached rate limit', function (done) {
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
          assert.instanceOf(err, TaskFatalError)
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
