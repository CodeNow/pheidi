'use strict'

const chai = require('chai')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const bigPoppa = require('models/big-poppa')
const mongoClient = require('mongo-helper').client

const SendWelcomeEmailToNewlyAddedUser = require('workers/organization.user.added').task

describe('organization.user.added', () => {
  describe('Worker', () => {
    let validJob
    let org
    let user
    const orgId = 45
    const orgGithubId = 2335750
    const organizationName = 'CodeNow'
    const userId = 59
    const userGithubId = 1981198
    const userName = 'thejsj'
    const userEmail = 'jorge.silva@thejsj.com'
    const creatorId = 100

    beforeEach(() => {
      validJob = {
        organization: {
          id: orgId,
          githubId: orgGithubId
        },
        user: {
          id: userId,
          githubId: userGithubId
        }
      }
      org = {
        name: organizationName,
        creator: {
          id: creatorId
        }
      }
      user = {
        email: userEmail,
        accounts: {
          github: {
            username: userName
          }
        }
      }
      sinon.stub(bigPoppa, 'getOrganization').resolves(org)
      sinon.stub(mongoClient, 'findOneUserAsync').resolves(user)
      sinon.stub(SendGrid.prototype, 'userAddedToOrganization').resolves(true)
    })

    afterEach(() => {
      bigPoppa.getOrganization.restore()
      mongoClient.findOneUserAsync.restore()
      SendGrid.prototype.userAddedToOrganization.restore()
    })

    it('should get the organization', done => {
      SendWelcomeEmailToNewlyAddedUser(validJob)
        .then(() => {
          sinon.assert.calledOnce(bigPoppa.getOrganization)
          sinon.assert.calledWithExactly(bigPoppa.getOrganization, orgId)
        })
        .asCallback(done)
    })

    it('should throw a `WorkerStopError` if the user is also the org creator', done => {
      org.creator.id = userId
      bigPoppa.getOrganization.resolves(org)

      SendWelcomeEmailToNewlyAddedUser(validJob)
        .asCallback(err => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /this.*organization.*creator.*already.*sent/i)
          done()
        })
    })

    it('should find the user in Mongo', done => {
      SendWelcomeEmailToNewlyAddedUser(validJob)
        .then(() => {
          sinon.assert.calledOnce(mongoClient.findOneUserAsync)
          sinon.assert.calledWithExactly(mongoClient.findOneUserAsync, {
            'accounts.github.id': userGithubId
          })
        })
        .asCallback(done)
    })

    it('should throw an error if there is no username', done => {
      user.accounts.github.username = null
      mongoClient.findOneUserAsync.resolves(user)

      SendWelcomeEmailToNewlyAddedUser(validJob)
      .asCallback((err) => {
        assert.isOk(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /user.*not.*exist.*username/i)
        done()
      })
    })

    it('should throw an error if there is no email', done => {
      user.email = null
      mongoClient.findOneUserAsync.resolves(user)

      SendWelcomeEmailToNewlyAddedUser(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /user.*not.*exist.*email/i)
          done()
        })
    })

    it('should send the email', (done) => {
      SendWelcomeEmailToNewlyAddedUser(validJob)
        .then(() => {
          sinon.assert.calledOnce(SendGrid.prototype.userAddedToOrganization)
          sinon.assert.calledWithExactly(
            SendGrid.prototype.userAddedToOrganization,
            organizationName,
            userEmail,
            userName
          )
        })
        .asCallback(done)
    })

    it('should throw any error thrown by `findOneUserAsync`', (done) => {
      const thrownErr = new Error()
      mongoClient.findOneUserAsync.rejects(thrownErr)

      SendWelcomeEmailToNewlyAddedUser(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.equal(err, thrownErr)
          done()
        })
    })

    it('should throw a `WorkerStopError` if it cant send the email', (done) => {
      const thrownErr = new Error()
      SendGrid.prototype.userAddedToOrganization.rejects(thrownErr)

      SendWelcomeEmailToNewlyAddedUser(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /failed.*email/i)
          done()
        })
    })
  })
})
