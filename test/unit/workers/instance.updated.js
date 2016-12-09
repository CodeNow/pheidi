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
const utils = require('models/utils')
const Worker = JobModule.task

describe('Instance Updated Worker', function () {
  let instance
  describe('worker', function () {
    describe('regular flow', function () {
      beforeEach(function (done) {
        const repo = 'CodeNow/api'
        const branch = 'feature1'
        const state = 'failed'
        instance = {
          owner: {
            github: 2828361,
            username: 'Runnable'
          },
          contextVersion: {
            appCodeVersions: [{
              repo,
              branch
            }],
            build: {
              failed: true
            }
          }
        }
        sinon.stub(rabbitmq, 'publishGitHubBotNotify').returns()
        // sinon.stub(utils, 'getPushInfoForInstance').returns({
          // repo,
          // branch,
          // state
        // })
        done()
      })

      afterEach(function (done) {
        rabbitmq.publishGitHubBotNotify.restore()
        // utils.getPushInfoForInstance.restore()
        done()
      })

      it('should fail if notifyOnUpdate throwed', function (done) {
        const githubError = new Error('GitHub error')
        rabbitmq.publishGitHubBotNotify.throws(githubError)

        Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.equal(err.message, githubError.message)
          done()
        })
      })

      it('should do nothing if testing instance', function (done) {
        instance.isTesting = true
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNotNull(err)
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
          done()
        })
      })

      it('should do nothing if no acv was found', function (done) {
        instance.contextVersion.appCodeVersions[0].additionalRepo = true
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNotNull(err)
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
          done()
        })
      })

      it('should do nothing if instance state is invalid', function (done) {
        instance.contextVersion.build = {}
        Worker({ instance: instance }).asCallback(function (err) {
          assert.isNotNull(err)
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
          done()
        })
      })

      it('should call rabbitmq.publishGitHubBotNotify', function (done) {
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
