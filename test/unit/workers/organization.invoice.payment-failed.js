'use strict'

const chai = require('chai')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const Mongodb = require('models/mongo')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const OrganizationService = require('services/organization-service')

const NotifyInvoicePaymentFailure = require('workers/organization.invoice.payment-failed').task

describe('organization.invoice.payment-failed', () => {
  describe('Worker', () => {
    let billingErrorToAdminStub
    let billingErrorToAllMembersStub
    let getAllUserEmailsForOrganizationStub
    let getHasPaymentMethodForOrganizationStub
    let getUserEmailByGithubIdStub

    let validJob
    let emails
    const orgId = 2335750
    const organizationName = 'helloWorld'
    const paymentMethodOwnerEmail = 'jorge.silva@thejsj.com'
    const paymentMethodAddedGithubId = 1981198
    const email1 = paymentMethodOwnerEmail
    const email2 = 'jorge.silva.jetter@gmail.com'

    beforeEach(() => {
      validJob = {
        invoicePaymentHasFailedFor24Hours: false,
        organization: {
          id: orgId,
          name: organizationName
        },
        paymentMethodOwner: {
          githubId: paymentMethodAddedGithubId
        }
      }
      emails = [email1, email2]
      getAllUserEmailsForOrganizationStub = sinon.stub(OrganizationService, 'getAllUserEmailsForOrganization').resolves(emails)
      getHasPaymentMethodForOrganizationStub = sinon.stub(OrganizationService, 'getHasPaymentMethodForOrganization').resolves(true)
      getUserEmailByGithubIdStub = sinon.stub(Mongodb.prototype, 'getUserEmailByGithubId').resolves(paymentMethodOwnerEmail)
      billingErrorToAllMembersStub = sinon.stub(SendGrid.prototype, 'billingErrorToAllMembers').resolves(true)
      billingErrorToAdminStub = sinon.stub(SendGrid.prototype, 'billingErrorToAdmin').resolves(true)
    })

    afterEach(() => {
      billingErrorToAdminStub.restore()
      billingErrorToAllMembersStub.restore()
      getAllUserEmailsForOrganizationStub.restore()
      getHasPaymentMethodForOrganizationStub.restore()
      getUserEmailByGithubIdStub.restore()
    })

    describe('First notification (invoicePaymentHasFailedFor24Hours : false)', () => {
      it('should get the email for the user', (done) => {
        NotifyInvoicePaymentFailure(validJob)
          .then(() => {
            sinon.assert.calledOnce(getUserEmailByGithubIdStub)
            sinon.assert.calledWithExactly(
              getUserEmailByGithubIdStub,
              paymentMethodAddedGithubId
            )
          })
          .asCallback(done)
      })

      it('should not send an email without a payment method', (done) => {
        getHasPaymentMethodForOrganizationStub.resolves(false)
        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /Organization does not have a payment method/)
            done()
          })
      })

      it('should send the email', (done) => {
        NotifyInvoicePaymentFailure(validJob)
          .then(() => {
            sinon.assert.calledOnce(billingErrorToAdminStub)
            sinon.assert.calledWithExactly(
              billingErrorToAdminStub,
              organizationName,
              paymentMethodOwnerEmail
            )
          })
          .asCallback(done)
      })

      it('should throw any error thrown by `getUserEmailByGithubId`', (done) => {
        const thrownErr = new Error()
        getUserEmailByGithubIdStub.rejects(thrownErr)

        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.equal(err, thrownErr)
            done()
          })
      })

      it('should throw a `WorkerStopError` if it cant send the email', (done) => {
        const thrownErr = new Error()
        billingErrorToAdminStub.rejects(thrownErr)

        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /failed.*email/i)
            done()
          })
      })

      it('should throw a `WorkerStopError` if there is no email addrress for the payment method owner', (done) => {
        getUserEmailByGithubIdStub.resolves(null)

        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /payment.*method.*owner.*email/i)
            done()
          })
      })
    })

    describe('Second notification (invoicePaymentHasFailedFor24Hours : true)', () => {
      beforeEach(() => {
        validJob.invoicePaymentHasFailedFor24Hours = true
      })

      it('should get the email for the user', (done) => {
        NotifyInvoicePaymentFailure(validJob)
          .then(() => {
            sinon.assert.calledOnce(OrganizationService.getAllUserEmailsForOrganization)
            sinon.assert.calledWithExactly(
              OrganizationService.getAllUserEmailsForOrganization,
              orgId
            )
          })
          .asCallback(done)
      })

      it('should not send an email without a payment method', (done) => {
        getHasPaymentMethodForOrganizationStub.resolves(false)
        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /Organization does not have a payment method/)
            done()
          })
      })

      it('should send the email', (done) => {
        NotifyInvoicePaymentFailure(validJob)
          .then(() => {
            sinon.assert.calledOnce(billingErrorToAllMembersStub)
            sinon.assert.calledWithExactly(
              billingErrorToAllMembersStub,
              organizationName,
              emails
            )
          })
          .asCallback(done)
      })

      it('should throw any error thrown by `getUserEmailByGithubId`', (done) => {
        const thrownErr = new Error()
        OrganizationService.getAllUserEmailsForOrganization.rejects(thrownErr)

        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.equal(err, thrownErr)
            done()
          })
      })

      it('should throw a `WorkerStopError` if it cant send the email', (done) => {
        const thrownErr = new Error()
        billingErrorToAllMembersStub.rejects(thrownErr)

        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /failed.*email/i)
            done()
          })
      })

      it('should throw a `WorkerStopError` if there are no email addresses found for org', (done) => {
        getAllUserEmailsForOrganizationStub.resolves([])

        NotifyInvoicePaymentFailure(validJob)
          .asCallback((err) => {
            assert.isOk(err)
            assert.instanceOf(err, WorkerStopError)
            assert.match(err.message, /no.*email.*address/i)
            done()
          })
      })
    })
  })
})
