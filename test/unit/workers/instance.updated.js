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

const TaskFatalError = require('ponos').TaskFatalError
const GitHubBot = require('notifications/github.bot')
const Worker = require('workers/instance.updated')

describe('Instance Updated Worker', function () {
  describe('#instanceState', function () {
    it('should return failed if build failed', function (done) {
      const cv = {
        build: {
          failed: true
        }
      }
      const state = Worker._instanceState(cv, {})
      assert.equal(state, 'failed')
      done()
    })

    it('should return running if build completed', function (done) {
      const cv = {
        build: {
          failed: false,
          completed: new Date().getTime()
        }
      }
      const state = Worker._instanceState(cv, {})
      assert.equal(state, 'running')
      done()
    })

    it('should return stopped if build completed but container exited', function (done) {
      const cv = {
        build: {
          failed: false,
          completed: new Date().getTime()
        }
      }
      const container = {
        inspect: {
          State: {
            Status: 'exited'
          }
        }
      }
      const state = Worker._instanceState(cv, container)
      assert.equal(state, 'stopped')
      done()
    })

    it('should return build_started if build has that status', function (done) {
      const cv = {
        state: 'build_started',
        build: {}
      }
      const container = {}
      const state = Worker._instanceState(cv, container)
      assert.equal(state, 'building')
      done()
    })

    it('should return null if status cannot be calculated', function (done) {
      const cv = {
        state: 'build_not_started',
        build: {}
      }
      const container = {}
      const state = Worker._instanceState(cv, container)
      assert.isNull(state)
      done()
    })
  })
  describe('worker', function () {
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

      it('should throw a task fatal error if the job is missing a instance', function (done) {
        Worker({}).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /instance.*required/i)
          done()
        })
      })

      it('should throw a task fatal error if the instance is not an object', function (done) {
        Worker({ instance: 1 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, TaskFatalError)
          assert.isDefined(err.data.err)
          assert.match(err.data.err.message, /instance.*object/i)
          done()
        })
      })
    })
    describe('regular flow', function () {
      beforeEach(function (done) {
        sinon.stub(GitHubBot.prototype, 'notifyOnUpdate').yieldsAsync()
        done()
      })

      afterEach(function (done) {
        GitHubBot.prototype.notifyOnUpdate.restore()
        done()
      })

      it('should fail if notifyOnUpdate failed', function (done) {
        const githubError = new Error('GitHub error')
        GitHubBot.prototype.notifyOnUpdate.yieldsAsync(githubError)
        const instance = {
          owner: {
            github: 2828361
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
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isDefined(err)
          assert.equal(err.message, githubError.message)
          done()
        })
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
              ],
              build: {
                failed: true
              }
            }
          ]
        }
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.notifyOnUpdate)
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
              ],
              build: {
                failed: true
              }
            }
          ]
        }
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.notifyOnUpdate)
          done()
        })
      })

      it('should do nothing if instance state is invalid', function (done) {
        const instance = {
          owner: {
            github: 2828361
          },
          contextVersions: [
            {
              appCodeVersions: [
                {
                  repo: 'CodeNow/api',
                  branch: 'feature1'
                }
              ],
              build: {}
            }
          ]
        }
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.notifyOnUpdate)
          done()
        })
      })

      it('should call notifyOnUpdate', function (done) {
        const instance = {
          owner: {
            github: 2828361
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
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHubBot.prototype.notifyOnUpdate)
          sinon.assert.calledWith(GitHubBot.prototype.notifyOnUpdate,
            {
              repo: 'CodeNow/api',
              branch: 'feature1',
              state: 'failed'
            },
            instance)
          done()
        })
      })
    })
  })
})
