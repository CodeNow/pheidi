/**
 * Sendgrid Api Model
 *
 * Sendgrid allows us to send transactional emails to new, potential users.  This model helps build
 * the api request for both admin and normal user email invites.  All methods return promises, but
 * the inviteAdmin and inviteUser methods also take a cb
 *
 * @module lib/models/apis/sendgrid
 */

'use strict'

const Promise = require('bluebird')
const sendGrid = require('sendgrid')
const logger = require('logger').child({ module: 'sendgrid' })

const DOCK_CREATED_MESSAGES = {
  en: {
    subject: 'Your infrastructure is ready',
    body: 'Thanks for waiting! Now the %org% sandbox is good to go.',
    htmlBody: 'Thanks for waiting! Now the %org% sandbox is good to go.'
  }
}

const PAYMENT_METHOD_ADDED_BODY = 'Your payment info has been added to %organizationName%. We’ll charge future payments to your card for CodeNow. You can update your card anytime from Runnable, or with the button below.Thanks for waiting! Now the %organizationName% sandbox is good to go.'

const PAYMENT_METHOD_ADDED = {
  en: {
    subject: 'Your payment method has been added',
    body: PAYMENT_METHOD_ADDED_BODY,
    htmlBody: PAYMENT_METHOD_ADDED_BODY
  }
}

const PAYMENT_METHOD_REMOVED_BODY = 'Your payment info has been removed from %organizationName%. Just wanted to let you know that your payment info has been removed by someone else on your team and your card will not be charged on the next bill.'

const PAYMENT_METHOD_REMOVED = {
  en: {
    subject: 'Your payment method has been removed',
    body: PAYMENT_METHOD_REMOVED_BODY,
    htmlBody: PAYMENT_METHOD_REMOVED_BODY
  }
}

module.exports = class SendGridModel {

  constructor () {
    this.log = logger.child()
    this.log.trace('SendGridModel constructor')
    var error
    if (!process.env.SENDGRID_KEY) {
      error = new Error('SENDGRID: stubbing sendgrid, no SENDGRID_KEY')
      this.log.fatal(error)
      throw error
    }
    if (!process.env.SENDGRID_DOCK_CREATED_TEMPLATE) {
      error = new Error('SENDGRID: no user dock created template id given, missing SENDGRID_DOCK_CREATED_TEMPLATE')
      this.log.fatal(error)
      throw error
    }
    if (!process.env.SENDGRID_SENDER_NAME) {
      error = new Error('SENDGRID: no user dock created sender name given, missing SENDGRID_SENDER_NAME')
      this.log.fatal(error)
      throw error
    }
    if (!process.env.SENDGRID_SENDER_EMAIL) {
      error = new Error('SENDGRID: no user dock created sender email given, missing SENDGRID_SENDER_EMAIL')
      this.log.fatal(error)
      throw error
    }
    this._sendgrid = sendGrid(process.env.SENDGRID_KEY)
    this._sendgrid.sendAsync = Promise.promisify(this._sendgrid.send)
  }

  /**
   * Get the default options for sending an email
   *
   * @param {Object}     contentObject             - Object with necessary property for getting default options
   * @param {Object}     contentObject.en
   * @param {String}     contentObject.en.body     - Body for email
   * @param {String}     contentObject.en.htmlBody - HTML body for email
   * @returns {Object}                             - Object with default options
   */
  static _getDefaultEmailOptions (contentObject) {
    return {
      from: process.env.SENDGRID_SENDER_EMAIL,
      fromname: process.env.SENDGRID_SENDER_NAME,
      body: contentObject.en.body,
      htmlBody: contentObject.en.htmlBody,
      subject: contentObject.en.subject
    }
  }

  /**
   * Log errors for all email methods
   *
   * @param {String} methodName - Name of the class method
   * @param {Object} err - Error returned by Sendgrid API
   * @returns {undefined}
   * @throws {Error} - Rethrows received error
   */
  static errorHandler (methodName, err) {
    this.log.error({
      err: err
    }, `${methodName} failure`)
    throw err
  }

  /**
   * Helper to easily make and send out the email to alert users that their dock has spun up.
   * These currently all go to Praful, but that will change soon.
   *
   * @param   {Object} organization       - Github Org model for the org whose docks just spun up
   * @param   {Object} organization.login - Github Org name
   * @param   {Object} organization.email - Contact email for organization from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  dockCreated (organization) {
    const log = this.log.child({
      method: 'SendGridModel.dockCreated',
      org: organization.login
    })
    log.info('SendGridModel.dockCreated called')
    let defaultOpts = SendGridModel._getDefaultEmailOptions(DOCK_CREATED_MESSAGES)
    return this.sendEmail(Object.assign(defaultOpts, {
      email: organization.email,
      category: ['infrastructure-ready'],
      template: process.env.SENDGRID_DOCK_CREATED_TEMPLATE,
      substitutions: {
        '%org%': organization.login
      }
    }))
      .catch(SendGridModel.errorHandler.bind(this, 'dockCreated'))
  }

  /**
   * Inform the card holder that their payment method has been added
   *
   * @param   {Object}   organization            - Github Org model for the org whose docks just spun up
   * @param   {Object}   organization.login      - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  paymentMethodAdded (organization, paymentMethodOwnerEmail) {
    const log = this.log.child({
      method: 'SendGridModel.paymentMethodAdded',
      org: organization.login,
      paymentMethodOwnerEmail: paymentMethodOwnerEmail
    })
    log.info('SendGridModel.paymentMethodAdded called')
    let defaultOpts = SendGridModel._getDefaultEmailOptions(PAYMENT_METHOD_ADDED)
    return this.sendEmail(Object.assign(defaultOpts, {
      email: paymentMethodOwnerEmail,
      template: process.env.SENDGRID_PAYMENT_METHOD_ADDED_TEMPLATE,
      category: ['billing'],
      substitutions: {
        '%organizationName%': organization.login
      }
    }))
      .catch(SendGridModel.errorHandler.bind(this, 'paymentMethodAdded'))
  }

  /**
   * Inform the card holder that their payment method has been removed
   *
   * @param   {Object}   organization       - Github Org model for the org whose docks just spun up
   * @param   {Object}   organization.login - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  paymentMethodRemoved (organization, paymentMethodOwnerEmail) {
    const log = this.log.child({
      method: 'SendGridModel.paymentMethodRemoved',
      org: organization.login,
      paymentMethodOwnerEmail: paymentMethodOwnerEmail
    })
    log.info('SendGridModel.paymentMethodRemoved called')
    let defaultOpts = SendGridModel._getDefaultEmailOptions(PAYMENT_METHOD_REMOVED)
    return this.sendEmail(Object.assign(defaultOpts, {
      email: paymentMethodOwnerEmail,
      template: process.env.SENDGRID_PAYMENT_METHOD_REMOVED_TEMPLATE,
      category: ['billing'],
      substitutions: {
        '%organizationName%': organization.login
      }
    }))
      .catch(SendGridModel.errorHandler.bind(this, 'paymentMethodRemoved'))
  }

  /**
   * Internal method to actually send an email.  This method takes in an object with properties
   * similar to the sendgrid Email object constructor arguments.  This looks for substitutions and
   * templates, and adds them to the Email object correctly.
   * @param {Object} emailOptions
   * @param {String} emailOptions.email - recipient email address
   * @param {String} emailOptions.from - sender email address
   * @param {String} emailOptions.fromname - sender name that will appear in the from of the email
   * @param {String} emailOptions.subject - email subject
   * @param {String} emailOptions.body - text only content of the email
   * @param {String} emailOptions.htmlBody - html-version of the content. This must be sent, or the email will not include any html
   * @param {String} emailOptions.template - string id of the template
   * @param {Object} emailOptions.substitutions - map of substitutions keyed with the variable to be substituted
   * @returns {Promise} a promise containing the actual email request
   */
  sendEmail (emailOptions) {
    const log = this.log.child({})
    log.info({
      emailOptions: emailOptions
    }, 'SendGridModel.prototype.sendEmail')

    if (!this._sendgrid) {
      // If sendGrid was never initialized, then return a failed promise
      const missingApiKeyError = new Error('SendGridModel model is missing a valid api key')
      log.error({
        err: missingApiKeyError
      }, 'sendEmail missing api key')
      return Promise.reject(missingApiKeyError)
    }

    const email = new this._sendgrid.Email({
      to: emailOptions.email,
      from: emailOptions.from,
      fromname: emailOptions.fromname,
      subject: emailOptions.subject,
      text: emailOptions.body,
      html: emailOptions.htmlBody // HTML needs to be here, otherwise only a text email is sent
    })

    // If the email has substitution values, add them.  The keys should be surrounded by % like %key%
    if (emailOptions.substitutions) {
      Object.keys(emailOptions.substitutions).forEach(function (key) {
        if (emailOptions.substitutions[key] !== null) {
          console.log('key', key, emailOptions.substitutions[key])
          email.addSubstitution(key, emailOptions.substitutions[key])
        }
      })
    }

    // If the email has a template, add it.
    if (emailOptions.template) {
      email.setFilters({
        'templates': {
          'settings': {
            'enable': 1,
            'template_id': emailOptions.template
          }
        }
      })
    }
    // Actually make the sendGrid api call
    return this._sendgrid.sendAsync(email)
  }
}
