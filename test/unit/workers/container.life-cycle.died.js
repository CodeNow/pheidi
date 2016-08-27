'use strict'

const chai = require('chai')
const FatalGithubError = require('notifications/github.status').FatalGithubError
const GitHubStatus = require('notifications/github.status')
const mongodbHelper = require('mongo-helper')
const PreconditionError = require('notifications/github.status').PreconditionError
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert

const JobModule = require('workers/container.life-cycle.died')
const Worker = JobModule.task

describe('Container life-cycle died', () => {
  describe('Worker', () => {
    const mockMainAcv = {
      id: 'mainAcv'
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
            type: 'user-container',
            instanceId: 'deadbeefdead'
          }
        },
        Id: 'mockContainerId'
      }
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
      },
      container: {
        dockerContainer: mockParams.inspectData.Id
      }
    }
    let mongoHelperStubs
    let collectionFindStub

    beforeEach((done) => {
      collectionFindStub = sinon.stub().yields(null, [mockInstance])
      mongoHelperStubs = {
        db: {
          collection: sinon.stub().returns({
            find: sinon.stub().returns({
              toArray: collectionFindStub
            })
          })
        }
      }
      sinon.stub(mongodbHelper, 'helper').returns(mongoHelperStubs)
      sinon.stub(JobModule, 'calculateStatus').returns(mockStatus)
      sinon.stub(GitHubStatus.prototype, 'setStatus').resolves(mockGithubStatusResponse)
      done()
    })

    afterEach((done) => {
      mongodbHelper.helper.restore()
      JobModule.calculateStatus.restore()
      GitHubStatus.prototype.setStatus.restore()
      done()
    })

    it('should fail if no instance is found', (done) => {
      collectionFindStub.yields()
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /not found/i)
        done()
      })
    })

    it('should fail if the instance does not have the user container attached', (done) => {
      collectionFindStub.yields(null, [{
        _id: '1234',
        isTesting: true,
        container: {
          dockerContainer: 'nonMatchingDockerContainer'
        }
      }])
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /not attached/i)
        done()
      })
    })

    it('should fail if the instance has no main acv', (done) => {
      collectionFindStub.yields(null, [{
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
      }])
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /not a repo based/i)
        done()
      })
    })

    it('should calculate the status', (done) => {
      Worker(mockParams).asCallback((err) => {
        assert.isNull(err)
        sinon.assert.calledOnce(JobModule.calculateStatus)
        sinon.assert.calledWith(JobModule.calculateStatus, mockParams)
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
        assert.instanceOf(err, WorkerStopError)
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
        assert.instanceOf(err, WorkerStopError)
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
      assert.equal(JobModule.calculateStatus(mockJob), 'failure')
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
      assert.equal(JobModule.calculateStatus(mockJob), null)
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
      assert.equal(JobModule.calculateStatus(mockJob), 'success')
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
      assert.equal(JobModule.calculateStatus(mockJob), 'error')
      done()
    })
  })
})
