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

const Worker = require('workers/container.life-cycle.started')

describe('Container life-cycle started', () => {
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
    const mockCv = {
      _id: 'cv id',
      context: 'deadbeefdead'
    }
    let mongoHelperStubs
    let collectionFindStub

    beforeEach((done) => {
      sinon.stub(Promise.prototype, 'delay').resolves()
      collectionFindStub = sinon.stub().yields(null, [mockInstance])
      mongoHelperStubs = {
        findOneContextVersionAsync: sinon.stub().resolves(mockCv),
        db: {
          collection: sinon.stub().returns({
            find: sinon.stub().returns({
              toArray: collectionFindStub
            })
          })
        }
      }
      sinon.stub(mongodbHelper, 'helper').returns(mongoHelperStubs)
      sinon.stub(GitHubStatus.prototype, 'setStatus').resolves(mockGithubStatusResponse)
      done()
    })

    afterEach((done) => {
      Promise.prototype.delay.restore()
      mongodbHelper.helper.restore()
      GitHubStatus.prototype.setStatus.restore()
      done()
    })

    it('should fail if no context version is found', (done) => {
      collectionFindStub.yields(null)
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /not found/i)
        assert.isFalse(err.data.report)
        done()
      })
    })

    it('should fail if no instance is found', (done) => {
      mongoHelperStubs.findOneContextVersionAsync.resolves()
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /context version/i)
        assert.isFalse(err.data.report)
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
        assert.isFalse(err.data.report)
        done()
      })
    })

    it('should try to set the status in github', (done) => {
      Worker(mockParams).asCallback((err) => {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHubStatus.prototype.setStatus)
        sinon.assert.calledWith(GitHubStatus.prototype.setStatus, mockInstance, mockMainAcv, 'pending')
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
})
