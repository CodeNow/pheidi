'use strict'

const chai = require('chai')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const mongoHelper = require('mongo-helper')
const NotifyPaymentMethodRemoved = require('workers/organization.payment-method.removed').task

describe('organization.payment-method.removed', () => {
  describe('Worker', () => {
    let validJob
    const organizationName = 'helloWorld'
    const userGithubId = 1981198
    const paymentMethodOwnerEmail = 'jorge@runnable.com'

    beforeEach(() => {
      validJob = {
        organization: {
          name: organizationName
        },
        paymentMethodOwner: {
          githubId: userGithubId
        }
      }
      sinon.stub(mongoHelper, 'getUserEmailByGithubId').resolves(paymentMethodOwnerEmail)
      sinon.stub(SendGrid.prototype, 'paymentMethodRemoved').resolves(true)
    })

    afterEach(() => {
      SendGrid.prototype.paymentMethodRemoved.restore()
      mongoHelper.getUserEmailByGithubId.restore()
    })

    it('should get the email for the user', (done) => {
      NotifyPaymentMethodRemoved(validJob)
        .then(() => {
          sinon.assert.calledOnce(mongoHelper.getUserEmailByGithubId)
          sinon.assert.calledWithExactly(mongoHelper.getUserEmailByGithubId,
            userGithubId
          )
        })
        .asCallback(done)
    })

    it('should send the email', (done) => {
      NotifyPaymentMethodRemoved(validJob)
        .then(() => {
          sinon.assert.calledOnce(SendGrid.prototype.paymentMethodRemoved)
          sinon.assert.calledWithExactly(
            SendGrid.prototype.paymentMethodRemoved,
            organizationName,
            paymentMethodOwnerEmail
          )
        })
        .asCallback(done)
    })

    it('should throw any `WorkerStopError` if no email is returned', (done) => {
      mongoHelper.getUserEmailByGithubId.resolves(null)

      NotifyPaymentMethodRemoved(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /payment.*method.*owner.*email/i)
          done()
        })
    })

    it('should throw any error thrown by `getUserEmailByGithubId`', (done) => {
      const thrownErr = new Error()
      mongoHelper.getUserEmailByGithubId.rejects(thrownErr)

      NotifyPaymentMethodRemoved(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.equal(err, thrownErr)
          done()
        })
    })

    it('should throw a `WorkerStopError` if it cant send the email', (done) => {
      const thrownErr = new Error()
      SendGrid.prototype.paymentMethodRemoved.rejects(thrownErr)

      NotifyPaymentMethodRemoved(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /failed.*email/i)
          done()
        })
    })
  })
})
