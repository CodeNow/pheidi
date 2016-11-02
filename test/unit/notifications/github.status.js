'use strict'

const chai = require('chai')
const GitHub = require('models/github')
const GithubStatus = require('notifications/github.status')
const Mongo = require('models/mongo')
const sinon = require('sinon')

chai.use(require('chai-as-promised'))
const assert = chai.assert
const githubStatus = new GithubStatus()

describe('github.status', () => {
  describe('setStatus', () => {
    let mockInstance
    let mockMainACV
    let mockState
    let mockUser
    let mockMessage
    let mockMasterInstance

    beforeEach(() => {
      mockMessage = 'mock message'
      mockInstance = {
        owner: {
          username: 'foo'
        },
        name: 'hello',
        contextVersion: {
          createdBy: {
            github: 1234
          }
        },
        parent: '1234',
        masterPod: false
      }
      mockMasterInstance = {
        owner: {
          username: 'foo'
        },
        name: 'helloMaster',
        contextVersion: {
          createdBy: {
            github: 1234
          }
        },
        masterPod: true,
        shortHash: '1234'
      }
      mockUser = {
        accounts: {
          github: {
            accessToken: 'mockAccessToken'
          }
        }
      }
      mockMainACV = {
        lowerRepo: 'foo/hello',
        commit: 'commitsha'
      }
      mockState = 'success'
      sinon.stub(Mongo.prototype, 'findOneUserAsync').resolves(mockUser)
      sinon.stub(Mongo.prototype, 'findOneInstanceAsync').resolves(mockMasterInstance)
      sinon.stub(GitHub.prototype, 'createStatus').resolves()
    })

    afterEach(() => {
      Mongo.prototype.findOneUserAsync.restore()
      Mongo.prototype.findOneInstanceAsync.restore()
      GitHub.prototype.createStatus.restore()
    })

    it('should fail if CV is missing created by github', function (done) {
      mockInstance.contextVersion.createdBy = {}
      githubStatus.setStatus(mockInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isDefined(err)
          assert.instanceOf(err, GithubStatus.PreconditionError)
          assert.match(err.message, /Context Version/i)
          done()
        })
    })

    it('should fail if no user found', function (done) {
      Mongo.prototype.findOneUserAsync.resolves()
      githubStatus.setStatus(mockInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isDefined(err)
          assert.instanceOf(err, GithubStatus.PreconditionError)
          assert.match(err.message, /No user/i)
          done()
        })
    })

    it('should fail if user doesnt have an access token', function (done) {
      mockUser.accounts = {}
      Mongo.prototype.findOneUserAsync.resolves(mockUser)
      githubStatus.setStatus(mockInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isDefined(err)
          assert.instanceOf(err, GithubStatus.PreconditionError)
          assert.match(err.message, /accessToken/i)
          done()
        })
    })

    it('should fail if createStatus fails', function (done) {
      const error = new Error('github error')
      GitHub.prototype.createStatus.rejects(error)
      githubStatus.setStatus(mockInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isDefined(err)
          assert.instanceOf(err, GithubStatus.FatalGithubError)
          assert.match(err.message, /github error/i)
          done()
        })
    })

    it('should create a github status', function (done) {
      githubStatus.setStatus(mockMasterInstance, mockMainACV, mockState, mockMessage)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHub.prototype.createStatus)
          sinon.assert.calledWith(GitHub.prototype.createStatus, mockMasterInstance, mockMainACV, mockState, mockMessage, mockMasterInstance.name)
          done()
        })
    })

    it('should create a github status with default message', function (done) {
      githubStatus.setStatus(mockMasterInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHub.prototype.createStatus)
          sinon.assert.calledWith(GitHub.prototype.createStatus, mockMasterInstance, mockMainACV, mockState, 'Tests completed successfully', mockMasterInstance.name)
          done()
        })
    })

    it('should lookup the master if its not the masterpod', function (done) {
      githubStatus.setStatus(mockInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHub.prototype.createStatus)
          sinon.assert.calledWith(GitHub.prototype.createStatus, mockInstance, mockMainACV, mockState, 'Tests completed successfully', mockMasterInstance.name)
          sinon.assert.calledOnce(Mongo.prototype.findOneInstanceAsync)
          sinon.assert.calledWith(Mongo.prototype.findOneInstanceAsync, {
            masterPod: true,
            shortHash: '1234'
          })
          done()
        })
    })
  })
})
