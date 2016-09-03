/**
 * @module unit/models/apis/docker
 */
'use strict'
require('loadenv')()

var sinon = require('sinon')

const SendGridModel = require('models/sendgrid')
const Promise = require('bluebird')
const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const emailCopy = require('models/sendgrid-email-copy')

function thisShouldNotBeCalled () {
  throw new Error('This should not be called')
}

describe('sendgrid', function () {
  var error
  var sendgrid
  var rejectionPromise
  var successPromise

  describe('#constructor', () => {
    var SENDGRID_KEY
    before('Remove ENV for test', () => {
      SENDGRID_KEY = process.env.SENDGRID_KEY
      delete process.env.SENDGRID_KEY
    })
    after('Restore ENV for test', () => {
      process.env.SENDGRID_KEY = SENDGRID_KEY
    })
    it('should throw a fatal error if a key is missing', function (done) {
      Promise.try(() => {
        sendgrid = new SendGridModel()
      })
        .asCallback((err) => {
          assert.isOk(err)
          done()
        })
    })
  })

  describe('Methods', () => {
    const organizationName = 'Runnable'
    const emailsForAllMembersOfTOrganization = ['jorge.silva@thejsj.com']
    const paymentMethodOwnerEmail = 'jorge.silva@thejsj.com'

    const stubOutSendBillingEmail = function () {
      sinon.stub(sendgrid, 'sendBillingEmail').resolves()
    }
    const restoreSendBillingEmail = function () {
      sendgrid.sendBillingEmail.resolves()
    }
    const stubOutSendEmail = function () {
      sinon.stub(sendgrid, 'sendEmail').resolves()
    }
    const restoreSendEmail = function () {
      sendgrid.sendEmail.resolves()
    }

    beforeEach(function (done) {
      error = new Error('this is an error')
      rejectionPromise = Promise.reject(error)
      rejectionPromise.suppressUnhandledRejections()
      successPromise = Promise.resolve(true)
      done()
    })
    describe('testing all successfull functionality', function () {
      beforeEach(function (done) {
        sendgrid = new SendGridModel()
        sinon.stub(sendgrid._sendgrid, 'sendAsync')
        done()
      })
      afterEach(function (done) {
        sendgrid._sendgrid.sendAsync.restore()
        done()
      })

      describe('#sendEmail', function () {
        describe('success', function () {
          beforeEach(function (done) {
            sendgrid._sendgrid.sendAsync.returns(successPromise)
            done()
          })
          it('should send emails with the given arguments', function (done) {
            var emailOpts = {
              email: 'hello',
              subject: 'asdasdasd',
              body: '11212312313',
              htmlBody: 'asdfasdfadsfadsf'
            }

            sendgrid.sendEmail(emailOpts)
              .then(function () {
                sinon.assert.calledOnce(sendgrid._sendgrid.sendAsync)
                var emailObject = sendgrid._sendgrid.sendAsync.args[0][0]

                assert.equal(emailObject.to, emailOpts.email)
                assert.equal(emailObject.subject, emailOpts.subject)
                assert.equal(emailObject.text, emailOpts.body)
                assert.equal(emailObject.html, emailOpts.htmlBody)
              })
              .asCallback(done)
          })

          it('should send an email with substitutions and a template', function (done) {
            var emailOpts = {
              email: 'hello',
              subject: 'asdasdasd',
              body: '11212312313',
              htmlBody: 'asdfasdfadsfadsf',
              substitutions: {
                'hello': 'chickenbutt'
              },
              template: 'asdasdasd'
            }

            sendgrid.sendEmail(emailOpts)
              .then(function () {
                sinon.assert.calledOnce(sendgrid._sendgrid.sendAsync)
                var emailObject = sendgrid._sendgrid.sendAsync.args[0][0]
                assert.equal(emailObject.to, emailOpts.email)
                assert.equal(emailObject.subject, emailOpts.subject)
                assert.equal(emailObject.text, emailOpts.body)
                assert.equal(emailObject.html, emailOpts.htmlBody)
                assert.deepEqual(emailObject.smtpapi.header.sub.hello, [emailOpts.substitutions.hello])
                assert.deepEqual(emailObject.smtpapi.header.filters, {
                  'templates': {
                    'settings': {
                      'enable': 1,
                      'template_id': emailOpts.template
                    }
                  }
                })
              })
              .asCallback(done)
          })
        })
        describe('failure', function () {
          beforeEach(function (done) {
            sendgrid._sendgrid.sendAsync.returns(rejectionPromise)
            done()
          })
          it('should return the normal error when isOperational', function (done) {
            error.isOperational = true
            sendgrid.sendEmail({
              email: 'hello',
              subject: 'asdasdasd',
              body: '11212312313'
            })
              .then(thisShouldNotBeCalled)
              .catch(function (err) {
                assert.equal(err, error)
                sinon.assert.calledOnce(sendgrid._sendgrid.sendAsync)
              })
              .asCallback(done)
          })
        })
      })

      describe('#dockCreated', function () {
        var org
        beforeEach(function () {
          org = {
            login: 'Runnable',
            id: 12312231
          }
        })

        beforeEach(stubOutSendEmail)
        afterEach(restoreSendEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.sendEmail.returns(Promise.resolve(true))

          sendgrid.dockCreated(org)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendEmail)
              var sendEmailOptions = sendgrid.sendEmail.args[0][0]
              assert.equal(sendEmailOptions.from, 'support@runnable.com')
              assert.equal(sendEmailOptions.fromname, 'Runnable Support')
              assert.equal(sendEmailOptions.subject, 'Your infrastructure is ready')
              assert.isString(sendEmailOptions.template)
              assert.isString(sendEmailOptions.body)
              assert.equal(sendEmailOptions.body, emailCopy.DOCK_CREATED_MESSAGES.en.body)
              assert.isString(sendEmailOptions.htmlBody)
              assert.equal(sendEmailOptions.htmlBody, emailCopy.DOCK_CREATED_MESSAGES.en.htmlBody)
              assert.isObject(sendEmailOptions.substitutions)
              assert.equal(sendEmailOptions.substitutions['%org%'], 'Runnable')
            })
            .asCallback(done)
        })
      })

      describe('#sendBillingEmail', function () {
        const templateName = 'hello'
        beforeEach(stubOutSendEmail)
        afterEach(restoreSendEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.sendEmail.returns(Promise.resolve(true))

          sendgrid.sendBillingEmail(organizationName, paymentMethodOwnerEmail, emailCopy.PAYMENT_METHOD_ADDED, templateName)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendEmail)
              var sendEmailOptions = sendgrid.sendEmail.args[0][0]
              assert.equal(sendEmailOptions.email, paymentMethodOwnerEmail)
              assert.equal(sendEmailOptions.fromname, 'Runnable Support')
              assert.equal(sendEmailOptions.subject, emailCopy.PAYMENT_METHOD_ADDED.en.subject)
              assert.isString(sendEmailOptions.template)
              assert.equal(sendEmailOptions.template, templateName)
              assert.isString(sendEmailOptions.body)
              assert.equal(sendEmailOptions.body, emailCopy.PAYMENT_METHOD_ADDED.en.body)
              assert.isString(sendEmailOptions.htmlBody)
              assert.equal(sendEmailOptions.htmlBody, emailCopy.PAYMENT_METHOD_ADDED.en.htmlBody)
              assert.isObject(sendEmailOptions.substitutions)
              assert.equal(sendEmailOptions.substitutions['%organizationName%'], 'Runnable')
            })
            .asCallback(done)
        })
      })

      describe('#paymentMethodAdded', function () {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.paymentMethodAdded(organizationName, paymentMethodOwnerEmail)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], paymentMethodOwnerEmail)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.PAYMENT_METHOD_ADDED)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_PAYMENT_METHOD_ADDED_TEMPLATE)
            })
            .asCallback(done)
        })
      })

      describe('#paymentMethodRemoved', function () {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.paymentMethodRemoved(organizationName, paymentMethodOwnerEmail)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], paymentMethodOwnerEmail)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.PAYMENT_METHOD_REMOVED)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_PAYMENT_METHOD_REMOVED_TEMPLATE)
            })
            .asCallback(done)
        })
      })

      describe('#trialEnding', () => {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.trialEnding(organizationName, emailsForAllMembersOfTOrganization)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], emailsForAllMembersOfTOrganization)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.TRIAL_ENDING)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_TRIAL_ENDING_TEMPLATE)
            })
            .asCallback(done)
        })
      })

      describe('#trialEnded', () => {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.trialEnded(organizationName, emailsForAllMembersOfTOrganization)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], emailsForAllMembersOfTOrganization)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.TRIAL_ENDED)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_TRIAL_ENDED_TEMPLATE)
            })
            .asCallback(done)
        })
      })

      describe('#planChanged', () => {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.planChanged(organizationName, emailsForAllMembersOfTOrganization)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], emailsForAllMembersOfTOrganization)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.PLAN_CHANGED)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_PLAN_CHANGED_TEMPLATE)
            })
            .asCallback(done)
        })
      })

      describe('#billingErrorToAdmin', () => {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.billingErrorToAdmin(organizationName, emailsForAllMembersOfTOrganization)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], emailsForAllMembersOfTOrganization)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.BILLING_ERROR_ADMIN)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_BILLING_ERROR_ADMIN_TEMPLATE)
            })
            .asCallback(done)
        })
      })

      describe('#billingErrorToAllMembers', () => {
        beforeEach(stubOutSendBillingEmail)
        afterEach(restoreSendBillingEmail)

        it('should attempt to send emails with the given arguments', function (done) {
          sendgrid.billingErrorToAllMembers(organizationName, emailsForAllMembersOfTOrganization)
            .then(function () {
              sinon.assert.calledOnce(sendgrid.sendBillingEmail)
              var paymentMethodAddedOrRemovedArgs = sendgrid.sendBillingEmail.args[0]
              assert.equal(paymentMethodAddedOrRemovedArgs[0], organizationName)
              assert.equal(paymentMethodAddedOrRemovedArgs[1], emailsForAllMembersOfTOrganization)
              assert.equal(paymentMethodAddedOrRemovedArgs[2], emailCopy.BILLING_ERROR_ALL)
              assert.equal(paymentMethodAddedOrRemovedArgs[3], process.env.SENDGRID_BILLING_ERROR_ALL_TEMPLATE)
            })
            .asCallback(done)
        })
      })
    })
  })
})
