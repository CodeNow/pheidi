'use strict'

const Promise = require('bluebird')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const rabbitmq = require('rabbitmq')
const JobModule = require('workers/github.pull-request.opened')
const mongoClient = require('mongo-helper').client
const utils = require('models/utils')
const Worker = JobModule.task

describe('Github Pull-Request Opened Worker', function () {
  let instance1
  let instance2
  let instances
  let payload
  const repo = 'CodeNow/api'
  const branch = 'feature1'
  const state = 'failed'
  describe('Worker', function () {
    describe('Regular Flow', function () {
      beforeEach(function (done) {
        instance1 = {
          _id: {
            toString: () => '123'
          },
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
        instance2 = Object.assign({}, instance1)
        instances = [ instance1, instance2 ]
        payload = {
          payload: {
            pull_request: {
              head: {
                ref: branch,
                repo: {
                  full_name: repo
                }
              }
            }
          }
        }
        sinon.stub(rabbitmq, 'publishGitHubBotNotify')
        sinon.stub(mongoClient, 'findInstancesAsync').resolves(instances)
        sinon.stub(utils, 'getPushInfoForInstance').returns({
          repo,
          branch,
          state
        })
        done()
      })

      afterEach(function (done) {
        rabbitmq.publishGitHubBotNotify.restore()
        utils.getPushInfoForInstance.restore()
        mongoClient.findInstancesAsync.restore()
        done()
      })

      it('should query the database for instances', function (done) {
        Worker(payload).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(mongoClient.findInstancesAsync)
          sinon.assert.calledWith(mongoClient.findInstancesAsync, {
            'contextVersion.appCodeVersions': {
              $elemMatch: {
                lowerRepo: repo.toLowerCase(),
                lowerBranch: branch.toLowerCase(),
                additionalRepo: { $ne: true }
              }
            }
          })
          done()
        })
      })

      it('should run even if mongo returns `null`', function (done) {
        mongoClient.findInstancesAsync.resolves(null)
        Worker(payload).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
          done()
        })
      })

      it('should only call worker once if `getPushInfoForInstance` is called', function (done) {
        utils.getPushInfoForInstance.onFirstCall().returns(null)

        Worker(payload).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(rabbitmq.publishGitHubBotNotify)
          sinon.assert.calledWith(rabbitmq.publishGitHubBotNotify, {
            instance: instance2,
            pushInfo: { repo, branch, state }
          })
          done()
        })
      })

      it('should not call if `getPushInfoForInstance` is called', function (done) {
        utils.getPushInfoForInstance.returns(null)

        Worker(payload).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(rabbitmq.publishGitHubBotNotify)
          done()
        })
      })

      it('should call rabbitmq.publishGitHubBotNotify', function (done) {
        Worker(payload).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledTwice(rabbitmq.publishGitHubBotNotify)
          sinon.assert.calledWith(rabbitmq.publishGitHubBotNotify, {
            instance: instance1,
            pushInfo: { repo, branch, state }
          })
          sinon.assert.calledWith(rabbitmq.publishGitHubBotNotify, {
            instance: instance2,
            pushInfo: { repo, branch, state }
          })
          done()
        })
      })
    })
  })
})
