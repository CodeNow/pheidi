'use strict'

const chai = require('chai')
const GitHubStatus = require('notifications/github.status')
const mongodbHelper = require('mongo-helper')
const Promise = require('bluebird')
const sinon = require('sinon')
const TaskFatalError = require('ponos').TaskFatalError

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
    let mongoHelperStubs
    beforeEach((done) => {
      mongoHelperStubs = {
        findOneInstanceAsync: sinon.stub().resolves(mockInstance)
      }
      sinon.stub(mongodbHelper, 'helper').returns(mongoHelperStubs)
      sinon.stub(GitHubStatus.prototype, 'setStatus').resolves(mockGithubStatusResponse)
      done()
    })

    afterEach((done) => {
      mongodbHelper.helper.restore()
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

    it('should try to set the status in github', (done) => {
      Worker(mockParams).asCallback((err) => {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHubStatus.prototype.setStatus)
        sinon.assert.calledWith(GitHubStatus.prototype.setStatus, mockInstance, mockMainAcv, 'pending')
        done()
      })
    })
  })
})
