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
const Mongo = require('models/mongo')



// var ContextVersion = require('models/mongo/context-version')
// var Instance = require('models/mongo/instance')
// var PullRequest = require('models/apis/pullrequest')
// var Slack = require('notifications/index')
// var User = require('models/mongo/user')
var Worker = require('workers/instance.deployed')

describe('Instance Deployed Worker', function () {
  describe('worker', function () {
    var testInstanceId = '5633e9273e2b5b0c0077fd41'
    var testCvId = '2933e9211e2bbb0c00888876'
    var pushUserId = 123456
    var instanceCreatedById = 125
    var testData = {
      instanceId: testInstanceId,
      cvId: testCvId
    }
    var mockInstanceUser = { accounts: { github: { accessToken: 'instanceUserGithubToken' } } }
    var mockPushUser = { accounts: { github: { accessToken: 'pushUserGithubToken', username: 'anton' } } }

    var testInstance = {
      _id: testInstanceId,
      name: 'name1',
      shortHash: 'asd51a1',
      masterPod: true,
      owner: {
        github: 124,
        username: 'codenow',
        gravatar: ''
      },
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
    var testCv = {
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
      sinon.stub(Mongo.prototype, 'findOneInstanceAsync').resolves(testInstance)
      sinon.stub(Mongo.prototype, 'findOneContextVersionAsync').resolves(testCv)
      sinon.stub(Mongo.prototype, 'findOneUserAsync').rejects(new Error('define behavior'))
      Mongo.prototype.findOneUserAsync.withArgs(pushUserId).resolves(mockPushUser)
      Mongo.prototype.findOneUserAsync.withArgs(instanceCreatedById).resolves(mockInstanceUser)
      // sinon.stub(Slack, 'sendSlackDeployNotification')
      // sinon.createStubInstance(PullRequest)
      // sinon.stub(PullRequest.prototype, 'deploymentSucceeded')
      done()
    })

    afterEach(function (done) {
      Mongo.prototype.findOneInstanceAsync.restore()
      Mongo.prototype.findOneContextVersionAsync.restore()
      Mongo.prototype.findOneUserAsync.restore()

      // Slack.sendSlackDeployNotification.restore()
      // PullRequest.prototype.deploymentSucceeded.restore()
      done()
    })

    describe('errors', function () {
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

        it('should throw a task fatal error if the job is missing a instanceId', function (done) {
          Worker({}).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, TaskFatalError)
            assert.isDefined(err.data.err)
            assert.match(err.data.err.message, /instanceId.*required/i)
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

        it('should throw a task fatal error if the instanceId is not a string', function (done) {
          Worker({ instanceId: {} }).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, TaskFatalError)
            assert.isDefined(err.data.err)
            assert.match(err.data.err.message, /instanceId.*string/i)
            done()
          })
        })
        it('should throw a task fatal error if job is missing cvId', function (done) {
          Worker({ instanceId: testInstanceId }).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, TaskFatalError)
            assert.isDefined(err.data.err)
            assert.match(err.data.err.message, /cvId.*required/i)
            done()
          })
        })
        it('should throw a task fatal error if job is missing cvId', function (done) {
          Worker({ instanceId: testInstanceId, cvId: {} }).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, TaskFatalError)
            assert.isDefined(err.data.err)
            assert.match(err.data.err.message, /cvId.*string/i)
            done()
          })
        })
      })
      describe('behavioral errors', function () {
        it('should reject with any instance search error', function (done) {
          var mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneInstanceAsync.rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should reject with any cv search error', function (done) {
          var mongoError = new Error('Mongo failed')
          Mongo.prototype.findOneContextVersionAsync.rejects(mongoError)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.equal(err, mongoError)
            done()
          })
        })

        it('should reject when instance not found with TaskFatalError', function (done) {
          Mongo.prototype.findOneInstanceAsync.resolves(null)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, TaskFatalError)
            assert.match(err.message, /instance not found/i)
            done()
          })
        })

        it('should reject when context version not found with TaskFatalError', function (done) {
          Mongo.prototype.findOneContextVersionAsync.resolves(null)

          Worker(testData).asCallback(function (err) {
            assert.isDefined(err)
            assert.instanceOf(err, TaskFatalError)
            assert.match(err.message, /contextversion not found/i)
            done()
          })
        })
      //
      //   it('should return an error if instanceUser lookup failed', function (done) {
      //     var mongoError = new Error('Mongo failed')
      //     User.findByGithubIdAsync.withArgs(instanceCreatedById).rejects(mongoError)
      //
      //     Worker(testData).asCallback(function (err) {
      //       expect(err).to.exist()
      //       expect(err).to.equal(mongoError)
      //       done()
      //     })
      //   })
      //
      //   it('should return an error if pushUser lookup failed', function (done) {
      //     var mongoError = new Error('Mongo failed')
      //     User.findByGithubIdAsync.withArgs(pushUserId).rejects(mongoError)
      //
      //     Worker(testData).asCallback(function (err) {
      //       expect(err).to.exist()
      //       expect(err).to.equal(mongoError)
      //       done()
      //     })
      //   })
      //
      //   it('should reject instanceUser was not found', function (done) {
      //     User.findByGithubIdAsync.withArgs(instanceCreatedById).returns(null)
      //
      //     Worker(testData).asCallback(function (err) {
      //       expect(err).to.exist()
      //       expect(err).to.be.instanceOf(TaskFatalError)
      //       expect(err.message).to.match(/Instance creator not found/i)
      //       done()
      //     })
      //   })
      })
      // it('should find an instance', function (done) {
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.calledOnce(Instance.findByIdAsync)
      //     sinon.assert.calledWith(Instance.findByIdAsync, testInstanceId)
      //     done()
      //   })
      // })
      // it('should find a cv', function (done) {
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.calledOnce(ContextVersion.findByIdAsync)
      //     sinon.assert.calledWith(ContextVersion.findByIdAsync, testCvId)
      //     done()
      //   })
      // })
      // it('should find two users', function (done) {
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.calledTwice(User.findByGithubIdAsync)
      //     sinon.assert.calledWith(User.findByGithubIdAsync, instanceCreatedById)
      //     sinon.assert.calledWith(User.findByGithubIdAsync, pushUserId)
      //     done()
      //   })
      // })
      // it('should call slack notification', function (done) {
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.calledOnce(Slack.sendSlackDeployNotification)
      //     sinon.assert.calledWith(Slack.sendSlackDeployNotification,
      //       testCv.build.triggeredAction.appCodeVersion,
      //       mockPushUser.accounts.github.username,
      //       testInstance)
      //     done()
      //   })
      // })
      // it('should call pull request notification', function (done) {
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.calledOnce(PullRequest.prototype.deploymentSucceeded)
      //     sinon.assert.calledWith(PullRequest.prototype.deploymentSucceeded,
      //       testCv.build.triggeredAction.appCodeVersion,
      //       testInstance)
      //     done()
      //   })
      // })
      // it('should not call slack notification if pushUser was not found', function (done) {
      //   User.findByGithubIdAsync.withArgs(pushUserId).returns(null)
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.notCalled(Slack.sendSlackDeployNotification)
      //     done()
      //   })
      // })
      // it('should perform all these tasks in order', function (done) {
      //   Worker(testData).asCallback(function (err) {
      //     expect(err).to.not.exist()
      //     sinon.assert.callOrder(
      //       Instance.findByIdAsync,
      //       ContextVersion.findByIdAsync,
      //       User.findByGithubIdAsync,
      //       Slack.sendSlackDeployNotification,
      //       PullRequest.prototype.deploymentSucceeded
      //     )
      //     done()
      //   })
      // })
    })
  })
})
