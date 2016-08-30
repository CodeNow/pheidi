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
const isObject = require('101/is-object')
const joi = require('joi')

const log = require('logger').child({ module: 'sendgrid' })

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

const environmentSchema = joi.object({
  'SENDGRID_KEY': joi.string().required(),
  'SENDGRID_DOCK_CREATED_TEMPLATE': joi.string().required(),
  'SENDGRID_PAYMENT_METHOD_ADDED_TEMPLATE': joi.string().required(),
  'SENDGRID_PAYMENT_METHOD_REMOVED_TEMPLATE': joi.string().required(),
  'SENDGRID_SENDER_NAME': joi.string().required(),
  'SENDGRID_SENDER_EMAIL': joi.string().required()
}).unknown().required()

module.exports = class SendGridModel {

  constructor () {
    log.info('constructor called')
    const validatonResult = joi.validate(process.env, environmentSchema)
    if (validatonResult.error !== null) {
      log.fatal(validatonResult.error)
      throw validatonResult.error
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
   * Log and throws errors for all email methods
   *
   * @param {String} methodName - Name of the class method
   * @param {Object} err - Error returned by Sendgrid API
   * @returns {undefined}
   * @throws {Error} - Rethrows received error
   */
  static errorHandler (methodName, err) {
    log.error({
      err: err
    }, `${methodName} failure`)
    throw err
  }

  /**
   * Helper to easily make and send out the email to alert users that their dock has spun up.
   *
   * @param   {Object} organization       - Github Org model for the org whose docks just spun up
   * @param   {Object} organization.login - Github Org name
   * @param   {Object} organization.email - Contact email for organization from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  dockCreated (organization) {
    log.info({
      org: organization.login
    }, 'dockCreated called')
    const defaultOpts = SendGridModel._getDefaultEmailOptions(DOCK_CREATED_MESSAGES)
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
   * Inform the card holder that their payment method has been added or removed
   *
   * @param   {Object}   organization            - Github Org model for the org whose docks just spun up
   * @param   {Object}   organization.login      - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   * @param   {Object}   options                 - Default options for email
   * @param   {String}   templateName            - Sendgrid template id
   *
   * @returns {Promise} resolves when email request is done
   */
  paymentMethodAddedOrRemoved (organization, paymentMethodOwnerEmail, options, templateId) {
    log.info({
      org: organization.login,
      paymentMethodOwnerEmail: paymentMethodOwnerEmail
    }, 'paymentMethodAddedOrRemoved called')
    const defaultOpts = SendGridModel._getDefaultEmailOptions(options)
    return this.sendEmail(Object.assign(defaultOpts, {
      email: paymentMethodOwnerEmail,
      template: templateId,
      category: ['billing'],
      substitutions: {
        '%organizationName%': organization.login
      }
    }))
      .catch(SendGridModel.errorHandler.bind(this, 'paymentMethodAddedOrRemoved'))
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
    log.info({
      org: organization.login,
      paymentMethodOwnerEmail: paymentMethodOwnerEmail
    }, 'paymentMethodAdded called')
    return this.paymentMethodAddedOrRemoved(
      organization,
      paymentMethodOwnerEmail,
      PAYMENT_METHOD_ADDED,
      process.env.SENDGRID_PAYMENT_METHOD_ADDED_TEMPLATE
    )
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
    log.info({
      org: organization.login,
      paymentMethodOwnerEmail: paymentMethodOwnerEmail
    }, 'paymentMethodRemoved called')
    return this.paymentMethodAddedOrRemoved(
      organization,
      paymentMethodOwnerEmail,
      PAYMENT_METHOD_REMOVED,
      process.env.SENDGRID_PAYMENT_METHOD_REMOVED_TEMPLATE
    )
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
    log.info({
      emailOptions: emailOptions
    }, 'sendEmail')

    if (!this._sendgrid) {
      // If sendGrid was never initialized, then return a failed promise
      const missingApiKeyError = new Error('odel is missing a valid api key')
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
    if (isObject(emailOptions.substitutions)) {
      Object.keys(emailOptions.substitutions).forEach(function (key) {
        if (emailOptions.substitutions[key] !== null) {
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

module.exports.DOCK_CREATED_MESSAGES = DOCK_CREATED_MESSAGES
module.exports.PAYMENT_METHOD_ADDED = PAYMENT_METHOD_ADDED
module.exports.PAYMENT_METHOD_REMOVED = PAYMENT_METHOD_REMOVED
