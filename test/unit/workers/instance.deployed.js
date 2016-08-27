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

const ObjectID = require('mongodb').ObjectID
const WorkerStopError = require('error-cat/errors/worker-stop-error')
const Mongo = require('models/mongo')
const Slack = require('notifications/slack')
const Worker = require('workers/instance.deployed').task

describe('Instance Deployed Worker', function () {
  describe('worker', function () {
    const testInstanceId = '5633e9273e2b5b0c0077fd41'
    const testCvId = '2933e9211e2bbb0c00888876'
    const pushUserId = 123456
    const instanceCreatedById = 125
    const testData = {
      instanceId: testInstanceId,
      cvId: testCvId
    }
    const mockInstanceUser = { accounts: { github: { accessToken: 'instanceUserGithubToken' } } }
    const mockPushUser = { accounts: { github: { accessToken: 'pushUserGithubToken', username: 'anton' } } }
    const testSettings = {
      notifications: {
        slack: {
          apiToken: 'slack-token',
          githubUsernameToSlackIdMap: {
            'anton': 123
          }
        }
      }
    }
    const owner = {
      github: 2828361,
      username: 'codenow',
      gravatar: ''
    }
    const testInstance = {
      _id: testInstanceId,
      name: 'name1',
      shortHash: 'asd51a1',
      masterPod: true,
      owner: owner,
      createdBy: {
        github: instanceCreatedById,
        username: 'runnabear',
        gravatar: ''
      },
      container: {
        dockerContainer: '46080d6253c8db55b8bbb9408654896964b86c63e863f1b3b0301057d1ad92ba'
      },
      network: {
        hostIp: '0.0.0.0'
      },
      build: '507f191e810c19729de860e2',
      contextVersion: {
        createdBy: {
          github: pushUserId
        },
        appCodeVersions: [
          {
            lowerBranch: 'develop',
            additionalRepo: false
          }
        ]
      }
    }
    const testCv = {
      _id: testCvId,
      createdBy: {
        github: pushUserId
      },
      build: {
        triggeredBy: {
          github: pushUserId
        },
        triggeredAction: {
          appCodeVersion: {
            repo: 'codenow/api',
            branch: 'master',
            commit: 'commit-id'
          }
        }
      }
    }
    beforeEach(function (done) {
      sinon.stub(Mongo.prototype, 'connect').yieldsAsync()
      sinon.stub(Mongo.prototype, 'close').yieldsAsync()
      sinon.stub(Mongo.prototype, 'findOneInstanceAsync').resolves(testInstance)
      sinon.stub(Mongo.prototype, 'findOneContextVersionAsync').resolves(testCv)
      sinon.stub(Mongo.prototype, 'findOneSettingAsync').resolves(testSettings)
      sinon.stub(Mongo.prototype, 'findOneUserAsync').rejects(new Error('define behavior'))
      Mongo.prototype.findOneUserAsync.withArgs({ 'accounts.github.id': pushUserId }).resolves(mockPushUser)
      Mongo.prototype.findOneUserAsync.withArgs({ 'accounts.github.id': instanceCreatedById }).resolves(mockInstanceUser)
      sinon.stub(Slack.prototype, 'notifyOnAutoDeploy')
      done()
    })

    afterEach(function (done) {
      Mongo.prototype.connect.restore()
      Mongo.prototype.close.restore()
      Mongo.prototype.findOneInstanceAsync.restore()
      Mongo.prototype.findOneContextVersionAsync.restore()
      Mongo.prototype.findOneSettingAsync.restore()
      Mongo.prototype.findOneUserAsync.restore()
      Slack.prototype.notifyOnAutoDeploy.restore()
      done()
    })

    describe('errors', function () {
      describe('behavioral errors', function () {
        it('should reject with any instance search error', function (done) {
          const mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneInstanceAsync.rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should reject with any cv search error', function (done) {
          const mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneContextVersionAsync.rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should reject when instance not found with WorkerStopError', function (done) {
          Mongo.prototype.findOneInstanceAsync.resolves(null)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /instance not found/i)
            done()
          })
        })

        it('should reject when context version not found with WorkerStopError', function (done) {
          Mongo.prototype.findOneContextVersionAsync.resolves(null)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /contextversion not found/i)
            done()
          })
        })

        it('should reject when instance had no ownerUsername found with WorkerStopError', function (done) {
          Mongo.prototype.findOneInstanceAsync.resolves({})

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /instance owner username was not found/i)
            done()
          })
        })

        it('should return an error if instanceUser lookup failed', function (done) {
          const mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneUserAsync.withArgs({ 'accounts.github.id': instanceCreatedById }).rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should return an error if pushUser lookup failed', function (done) {
          const mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneUserAsync.withArgs({ 'accounts.github.id': pushUserId }).rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should return an error if settings lookup failed', function (done) {
          const mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneSettingAsync.rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should reject instanceUser was not found', function (done) {
          Mongo.prototype.findOneUserAsync.withArgs({ 'accounts.github.id': instanceCreatedById }).returns(null)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /Instance creator not found/i)
            done()
          })
        })
      })

      it('should find an instance', function (done) {
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(Mongo.prototype.findOneInstanceAsync)
          sinon.assert.calledWith(Mongo.prototype.findOneInstanceAsync, {
            _id: new ObjectID(testInstanceId)
          })
          done()
        })
      })

      it('should find a cv', function (done) {
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(Mongo.prototype.findOneContextVersionAsync)
          sinon.assert.calledWith(Mongo.prototype.findOneContextVersionAsync, { _id: new ObjectID(testCvId) })
          done()
        })
      })

      it('should find two users', function (done) {
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledTwice(Mongo.prototype.findOneUserAsync)
          sinon.assert.calledWith(Mongo.prototype.findOneUserAsync, { 'accounts.github.id': instanceCreatedById })
          sinon.assert.calledWith(Mongo.prototype.findOneUserAsync, { 'accounts.github.id': pushUserId })
          done()
        })
      })

      it('should find settings', function (done) {
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(Mongo.prototype.findOneSettingAsync)
          sinon.assert.calledWith(Mongo.prototype.findOneSettingAsync, { 'owner.github': testInstance.owner.github })
          done()
        })
      })

      it('should call slack notification', function (done) {
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.calledOnce(Slack.prototype.notifyOnAutoDeploy)
          sinon.assert.calledWith(Slack.prototype.notifyOnAutoDeploy,
            testCv.build.triggeredAction.appCodeVersion,
            mockPushUser.accounts.github.username,
            testInstance,
            sinon.match.func)
          done()
        })
      })

      it('should not call slack notification if pushUser was not found', function (done) {
        Mongo.prototype.findOneUserAsync.withArgs({ 'accounts.github.id': pushUserId }).returns(null)
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(Slack.prototype.notifyOnAutoDeploy)
          done()
        })
      })

      it('should not call slack notification if settings was not found', function (done) {
        Mongo.prototype.findOneSettingAsync.returns(null)
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(Slack.prototype.notifyOnAutoDeploy)
          done()
        })
      })

      it('should perform all these tasks in order', function (done) {
        Worker(testData).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.callOrder(
            Mongo.prototype.findOneInstanceAsync,
            Mongo.prototype.findOneContextVersionAsync,
            Mongo.prototype.findOneUserAsync,
            Mongo.prototype.findOneSettingAsync,
            Slack.prototype.notifyOnAutoDeploy
          )
          done()
        })
      })
    })
  })
})
