'use strict'

const chai = require('chai')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const OrganizationService = require('services/organization-service')

const NotifyTrialEnding = require('workers/organization.trial.ending').task

describe('organization.trial.ending', () => {
  describe('Worker', () => {
    let validJob
    let emails
    const orgId = 2335750
    const organizationName = 'helloWorld'
    const email1 = 'jorge.silva@thejsj.com'
    const email2 = 'jorge.silva.jetter@gmail.com'

    beforeEach(() => {
      validJob = {
        organization: {
          id: orgId,
          name: organizationName
        }
      }
      emails = [email1, email2]
      sinon.stub(OrganizationService, 'getAllUserEmailsForOrganization').resolves(emails)
      sinon.stub(SendGrid.prototype, 'trialEnding').resolves(true)
    })

    afterEach(() => {
      SendGrid.prototype.trialEnding.restore()
      OrganizationService.getAllUserEmailsForOrganization.restore()
    })

    it('should get the email for the user', (done) => {
      NotifyTrialEnding(validJob)
        .then(() => {
          sinon.assert.calledOnce(OrganizationService.getAllUserEmailsForOrganization)
          sinon.assert.calledWithExactly(
            OrganizationService.getAllUserEmailsForOrganization,
            orgId
          )
        })
        .asCallback(done)
    })

    it('should send the email', (done) => {
      NotifyTrialEnding(validJob)
        .then(() => {
          sinon.assert.calledOnce(SendGrid.prototype.trialEnding)
          sinon.assert.calledWithExactly(
            SendGrid.prototype.trialEnding,
            organizationName,
            emails
          )
        })
        .asCallback(done)
    })

    it('should throw any error thrown by `getUserEmailByGithubId`', (done) => {
      const thrownErr = new Error()
      OrganizationService.getAllUserEmailsForOrganization.rejects(thrownErr)

      NotifyTrialEnding(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.equal(err, thrownErr)
          done()
        })
    })

    it('should throw a `WorkerStopError` if it cant send the email', (done) => {
      const thrownErr = new Error()
      SendGrid.prototype.trialEnding.rejects(thrownErr)

      NotifyTrialEnding(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /failed.*email/i)
          done()
        })
    })
  })
})
