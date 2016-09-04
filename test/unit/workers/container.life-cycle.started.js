'use strict'

const chai = require('chai')
const FatalGithubError = require('notifications/github.status').FatalGithubError
const GitHubStatus = require('notifications/github.status')
const Mongo = require('models/mongo')
const PreconditionError = require('notifications/github.status').PreconditionError
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Worker = require('workers/container.life-cycle.started').task

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

    beforeEach((done) => {
      sinon.stub(Promise.prototype, 'delay').resolves()
      sinon.stub(Mongo.prototype, 'findInstancesAsync').resolves([mockInstance])
      sinon.stub(Mongo.prototype, 'findOneContextVersionAsync').resolves(mockCv)
      sinon.stub(GitHubStatus.prototype, 'setStatus').resolves(mockGithubStatusResponse)
      done()
    })

    afterEach((done) => {
      Promise.prototype.delay.restore()
      Mongo.prototype.findInstancesAsync.restore()
      Mongo.prototype.findOneContextVersionAsync.restore()
      GitHubStatus.prototype.setStatus.restore()
      done()
    })

    it('should fail if no context version is found', (done) => {
      Mongo.prototype.findInstancesAsync.resolves(null)
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /not found/i)
        done()
      })
    })

    it('should fail if no instance is found', (done) => {
      Mongo.prototype.findInstancesAsync.resolves()
      Worker(mockParams).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /context version/i)
        done()
      })
    })

    it('should fail if the instance has no main acv', (done) => {
      Mongo.prototype.findInstancesAsync.resolves([{
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
