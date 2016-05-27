'use strict'

const chai = require('chai')
const FatalGithubError = require('notifications/github.status').FatalGithubError
const GitHubStatus = require('notifications/github.status')
const mongodbHelper = require('mongo-helper')
const PreconditionError = require('notifications/github.status').PreconditionError
const Promise = require('bluebird')
const sinon = require('sinon')
const TaskFatalError = require('ponos').TaskFatalError

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Worker = require('workers/container.life-cycle.died')

describe('Container life-cycle died', () => {
  describe('Worker', () => {
    const mockMainAcv = {
      id: 'mainAcv'
    }
    const mockInstance = {
      _id: 'deadbeefdead',
      isTesting: true,
      contextVersion: {
        appCodeVersions: [
          {
            id: 'additionalAcv',
            additionalRepo: true
          },
          mockMainAcv
        ]
      }
    }
    const mockStatus = 'calculatedStatus'
    const mockGithubStatusResponse = {
      id: 'mockGithubStatusResponse'
    }
    const mockParams = {
      id: 'fakeId',
      inspectData: {
        Config: {
          Labels: {
            type: 'image-builder-container',
            instanceId: mockInstance._id
          }
        }
      }
    }
    let mongoHelperStubs

    beforeEach((done) => {
      mongoHelperStubs = {
        findOneInstanceAsync: sinon.stub().resolves(mockInstance)
      }
      sinon.stub(mongodbHelper, 'helper').returns(mongoHelperStubs)
      sinon.stub(Worker, 'calculateStatus').returns(mockStatus)
      sinon.stub(GitHubStatus.prototype, 'setStatus').resolves(mockGithubStatusResponse)
      done()
    })

    afterEach((done) => {
      mongodbHelper.helper.restore()
      Worker.calculateStatus.restore()
      GitHubStatus.prototype.setStatus.restore()
      done()
    })

    it('should fail if no instance is found', (done) => {
      mongoHelperStubs.findOneInstanceAsync.resolves()
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, TaskFatalError)
        assert.match(err.message, /not found/i)
        assert.isFalse(err.data.report)
        done()
      })
    })

    it('should fail if the instance is not for testing', (done) => {
      mongoHelperStubs.findOneInstanceAsync.resolves({
        _id: '1234',
        isTesting: false
      })
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, TaskFatalError)
        assert.match(err.message, /not for testing/i)
        assert.isFalse(err.data.report)
        done()
      })
    })

    it('should fail if the instance has no main acv', (done) => {
      mongoHelperStubs.findOneInstanceAsync.resolves({
        _id: '1234',
        isTesting: true,
        contextVersion: {
          appCodeVersions: [
            {
              id: 'additionalAcv',
              additionalRepo: true
            }
          ]
        }
      })
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, TaskFatalError)
        assert.match(err.message, /not a repo based/i)
        assert.isFalse(err.data.report)
        done()
      })
    })

    it('should calculate the status', (done) => {
      Worker(mockParams).asCallback((err) => {
        assert.isNull(err)
        sinon.assert.calledOnce(Worker.calculateStatus)
        sinon.assert.calledWith(Worker.calculateStatus, mockParams)
        done()
      })
    })

    it('should try to set the status in github', (done) => {
      Worker(mockParams).asCallback((err) => {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHubStatus.prototype.setStatus)
        sinon.assert.calledWith(GitHubStatus.prototype.setStatus, mockInstance, mockMainAcv, mockStatus)
        done()
      })
    })

    it('should throw task fatal when PreconditionError is returned from setStatus', function (done) {
      var err = new PreconditionError('Precondition failed')
      GitHubStatus.prototype.setStatus.rejects(err)
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, TaskFatalError)
        assert.match(err.message, /precondition/i)
        assert.instanceOf(err.data.originalError, PreconditionError)
        done()
      })
    })

    it('should throw task fatal when FatalGithubError is returned from setStatus', function (done) {
      var err = new FatalGithubError('You are not a github user or something')
      GitHubStatus.prototype.setStatus.rejects(err)
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, TaskFatalError)
        assert.match(err.message, /Github error/i)
        assert.instanceOf(err.data.originalError, FatalGithubError)
        done()
      })
    })
  })
  describe('calculateStatus', () => {
    it('should return failure for failed image builder container', function (done) {
      const mockJob = {
        inspectData: {
          State: {
            ExitCode: -1
          },
          Config: {
            Labels: {
              type: 'image-builder-container'
            }
          }
        }
      }
      assert.equal(Worker.calculateStatus(mockJob), 'failure')
      done()
    })

    it('should return null for successful image builder container', function (done) {
      const mockJob = {
        inspectData: {
          State: {
            ExitCode: 0
          },
          Config: {
            Labels: {
              type: 'image-builder-container'
            }
          }
        }
      }
      assert.equal(Worker.calculateStatus(mockJob), null)
      done()
    })

    it('should return success for completed user container', function (done) {
      const mockJob = {
        inspectData: {
          State: {
            ExitCode: 0
          },
          Config: {
            Labels: {
              type: 'user-container'
            }
          }
        }
      }
      assert.equal(Worker.calculateStatus(mockJob), 'success')
      done()
    })

    it('should return error for completed user container', function (done) {
      const mockJob = {
        inspectData: {
          State: {
            ExitCode: -1
          },
          Config: {
            Labels: {
              type: 'user-container'
            }
          }
        }
      }
      assert.equal(Worker.calculateStatus(mockJob), 'error')
      done()
    })
  })
})
