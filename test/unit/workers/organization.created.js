'use strict'

const chai = require('chai')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const SendWelcomeEmailForNewOrganization = require('workers/organization.created').task
const Mongodb = require('models/mongo')

describe('organization.created', () => {
  describe('Worker', () => {
    let validJob
    const organizationName = 'helloWorld'
    const userGithubId = 1981198
    const creatorEmail = 'jorge@runnable.com'
    const creatorUsername = 'thejsj'

    beforeEach(() => {
      validJob = {
        organization: {
          name: organizationName
        },
        creator: {
          githubId: userGithubId,
          githubUsername: creatorUsername
        }
      }
      sinon.stub(Mongodb.prototype, 'getUserEmailByGithubId').resolves(creatorEmail)
      sinon.stub(SendGrid.prototype, 'welcomeEmailForOrganization').resolves(true)
    })

    afterEach(() => {
      SendGrid.prototype.welcomeEmailForOrganization.restore()
      Mongodb.prototype.getUserEmailByGithubId.restore()
    })

    it('should get the email for the user', (done) => {
      SendWelcomeEmailForNewOrganization(validJob)
        .then(() => {
          sinon.assert.calledOnce(Mongodb.prototype.getUserEmailByGithubId)
          sinon.assert.calledWithExactly(Mongodb.prototype.getUserEmailByGithubId,
            userGithubId
          )
        })
        .asCallback(done)
    })

    it('should send the email', (done) => {
      SendWelcomeEmailForNewOrganization(validJob)
        .then(() => {
          sinon.assert.calledOnce(SendGrid.prototype.welcomeEmailForOrganization)
          sinon.assert.calledWithExactly(
            SendGrid.prototype.welcomeEmailForOrganization,
            organizationName,
            creatorEmail,
            creatorUsername
          )
        })
        .asCallback(done)
    })

    it('should throw any `WorkerStopError` if no email is returned', (done) => {
      Mongodb.prototype.getUserEmailByGithubId.resolves(null)

      SendWelcomeEmailForNewOrganization(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /organization.*creator.*email/i)
          done()
        })
    })

    it('should throw any error thrown by `getUserEmailByGithubId`', (done) => {
      const thrownErr = new Error()
      Mongodb.prototype.getUserEmailByGithubId.rejects(thrownErr)

      SendWelcomeEmailForNewOrganization(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.equal(err, thrownErr)
          done()
        })
    })

    it('should throw a `WorkerStopError` if it cant send the email', (done) => {
      const thrownErr = new Error()
      SendGrid.prototype.welcomeEmailForOrganization.rejects(thrownErr)

      SendWelcomeEmailForNewOrganization(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /failed.*email/i)
          done()
        })
    })
  })
})
