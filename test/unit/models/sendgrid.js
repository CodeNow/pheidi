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

function thisShouldNotBeCalled () {
  throw new Error('This should not be called')
}
describe('sendgrid', function () {
  var error
  var sendgrid
  var rejectionPromise
  var successPromise
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

    describe('sendEmail', function () {
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
    describe('dockCreated', function () {
      var org
      beforeEach(function (done) {
        org = {
          login: 'Runnable',
          id: 12312231
        }
        sinon.stub(sendgrid, 'sendEmail')
        done()
      })
      afterEach(function (done) {
        sendgrid.sendEmail.restore()
        done()
      })
      it('should attempt to send emails with the given arguments', function (done) {
        sendgrid.sendEmail.returns(Promise.resolve(true))

        sendgrid.dockCreated(org)
          .then(function () {
            sinon.assert.calledOnce(sendgrid.sendEmail)
            var sendEmailOptions = sendgrid.sendEmail.args[0][0]

            assert.equal(sendEmailOptions.email, 'signup@runnable.com')
            assert.equal(sendEmailOptions.from, 'support@runnable.com')
            assert.equal(sendEmailOptions.fromname, 'Runnable Support')
            assert.equal(sendEmailOptions.subject, 'Your infrastructure is ready')
            assert.isString(sendEmailOptions.template)
            assert.isString(sendEmailOptions.body)
            assert.isString(sendEmailOptions.htmlBody)
            assert.isObject(sendEmailOptions.substitutions)
            assert.equal(sendEmailOptions.substitutions['%org%'], 'Runnable')
          })
          .asCallback(done)
      })
    })
  })
})
