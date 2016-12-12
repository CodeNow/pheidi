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
const WorkerStopError = require('error-cat/errors/worker-stop-error')

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
        sinon.stub(utils, 'getPushInfoForInstance').resolves({
          repo,
          branch,
          state
        })
        done()
      })

      afterEach(function (done) {
        rabbitmq.publishGitHubBotNotify.restore()
        utils.getPushInfoForInstance.restore()
        done()
      })

      it('should fail if there publishGitHubBotNotify fails', function (done) {
        const githubError = new Error('GitHub error')
        rabbitmq.publishGitHubBotNotify.throws(githubError)

        Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.equal(err.message, githubError.message)
          done()
        })
      })

      it('should fail if there is no push info returned', function (done) {
        utils.getPushInfoForInstance.rejects(new Error())

        Worker({ instance: instance, timestamp: 1461010631023 }).asCallback(function (err) {
          assert.isDefined(err)
          assert.instanceOf(err, WorkerStopError)
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
