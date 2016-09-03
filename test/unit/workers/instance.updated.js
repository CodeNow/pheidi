/**
 * @module unit/workers/instance.updated
 */
'use strict'

const Promise = require('bluebird')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const rabbitmq = require('rabbitmq')
const JobModule = require('workers/instance.updated')
const Worker = JobModule.task

describe('Instance Updated Worker', function () {
  describe('worker', function () {
    describe('regular flow', function () {
      beforeEach(function (done) {
        sinon.stub(rabbitmq, 'publishGitHubBotNotify').returns()
        done()
      })

      afterEach(function (done) {
        rabbitmq.publishGitHubBotNotify.restore()
        done()
      })

      it('should fail if notifyOnUpdate throwed', function (done) {
        const githubError = new Error('GitHub error')
        rabbitmq.publishGitHubBotNotify.throws(githubError)
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
        Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.equal(err.message, githubError.message)
          done()
        })
      })

      it('should do nothing if testing instance', function (done) {
        const instance = {
          owner: {
            github: 2828361
          },
          isTesting: true,
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
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
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
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
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
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
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
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
          done()
        })
      })

      it('should call rabbitmq.publishGitHubBotNotify', function (done) {
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
        Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(rabbitmq.publishGitHubBotNotify)
          sinon.assert.calledWith(rabbitmq.publishGitHubBotNotify,
            {
              instance: instance,
              pushInfo: {
                repo: 'CodeNow/api',
                branch: 'feature1',
                state: 'failed'
              }
            })
          done()
        })
      })
    })
  })
})
