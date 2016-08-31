'use strict'

const chai = require('chai')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const NotifyPaymentMethodAdded = require('workers/organization.payment-method.added').task
const Mongodb = require('models/mongo')

describe('organization.payment-method.added', () => {
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
      sinon.stub(Mongodb.prototype, 'getUserEmailByGithubId').resolves(paymentMethodOwnerEmail)
      sinon.stub(SendGrid.prototype, 'paymentMethodAdded').resolves(true)
    })

    afterEach(() => {
      SendGrid.prototype.paymentMethodAdded.restore()
      Mongodb.prototype.getUserEmailByGithubId.restore()
    })

    it('should get the email for the user', (done) => {
      NotifyPaymentMethodAdded(validJob)
        .then(() => {
          sinon.assert.calledOnce(Mongodb.prototype.getUserEmailByGithubId)
          sinon.assert.calledWithExactly(Mongodb.prototype.getUserEmailByGithubId,
            userGithubId
          )
        })
        .asCallback(done)
    })

    it('should send the email', (done) => {
      NotifyPaymentMethodAdded(validJob)
        .then(() => {
          sinon.assert.calledOnce(SendGrid.prototype.paymentMethodAdded)
          sinon.assert.calledWithExactly(
            SendGrid.prototype.paymentMethodAdded,
            organizationName,
            paymentMethodOwnerEmail
          )
        })
        .asCallback(done)
    })

    it('should throw any `WorkerStopError` if no email is returned', (done) => {
      Mongodb.prototype.getUserEmailByGithubId.resolves(null)

      NotifyPaymentMethodAdded(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /payment.*method.*owner.*email/i)
          done()
        })
    })

    it('should throw any error thrown by `getUserEmailByGithubId`', (done) => {
      const thrownErr = new Error()
      Mongodb.prototype.getUserEmailByGithubId.rejects(thrownErr)

      NotifyPaymentMethodAdded(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.equal(err, thrownErr)
          done()
        })
    })

    it('should throw a `WorkerStopError` if it cant send the email', (done) => {
      const thrownErr = new Error()
      SendGrid.prototype.paymentMethodAdded.rejects(thrownErr)

      NotifyPaymentMethodAdded(validJob)
        .asCallback((err) => {
          assert.isOk(err)
          assert.instanceOf(err, WorkerStopError)
          assert.match(err.message, /failed.*email/i)
          done()
        })
    })
  })
})
