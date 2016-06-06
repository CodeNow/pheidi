'use strict'

const chai = require('chai')
const GitHub = require('models/github')
const GithubStatus = require('notifications/github.status')
const mongodbHelper = require('mongo-helper')
const sinon = require('sinon')

chai.use(require('chai-as-promised'))
const assert = chai.assert
const githubStatus = new GithubStatus()

describe('github.status', () => {
  describe('setStatus', () => {
    let mockInstance
    let mockMainACV
    let mockState
    let mongoHelperStubs
    let mockUser
    let mockMessage

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
        }
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
      mongoHelperStubs = {
        findOneUserAsync: sinon.stub().resolves(mockUser)
      }
      sinon.stub(mongodbHelper, 'helper').returns(mongoHelperStubs)
      sinon.stub(GitHub.prototype, 'createStatus').resolves()
    })

    afterEach(() => {
      mongodbHelper.helper.restore()
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
      mongoHelperStubs.findOneUserAsync.resolves()
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
      mongoHelperStubs.findOneUserAsync.resolves(mockUser)
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
      githubStatus.setStatus(mockInstance, mockMainACV, mockState, mockMessage)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHub.prototype.createStatus)
          sinon.assert.calledWith(GitHub.prototype.createStatus, mockInstance, mockMainACV, mockState, mockMessage)
          done()
        })
    })

    it('should create a github status with default message', function (done) {
      githubStatus.setStatus(mockInstance, mockMainACV, mockState)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHub.prototype.createStatus)
          sinon.assert.calledWith(GitHub.prototype.createStatus, mockInstance, mockMainACV, mockState, 'Tests completed successfully')
          done()
        })
    })
  })
})
