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

module.exports = SendGridModel
var DOCK_CREATED_MESSAGES = {
  en: {
    subject: 'Your infrastructure is ready'
  }
}

function SendGridModel () {
  this.log = logger.child({
    tx: true
  })
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
  if (!process.env.SENDGRID_DOCK_CREATED_SENDER_NAME) {
    error = new Error('SENDGRID: no user dock created sender name given, missing SENDGRID_DOCK_CREATED_SENDER_NAME')
    this.log.fatal(error)
    throw error
  }
  if (!process.env.SENDGRID_DOCK_CREATED_SENDER_EMAIL) {
    error = new Error('SENDGRID: no user dock created sender email given, missing SENDGRID_DOCK_CREATED_SENDER_EMAIL')
    this.log.fatal(error)
    throw error
  }
  this._sendgrid = sendGrid(process.env.SENDGRID_KEY)
  this._sendgrid.sendAsync = Promise.promisify(this._sendgrid.send)
}

/**
 * Helper to easily make and send out the email to alert users that their dock has spun up.
 * These currently all go to Praful, but that will change soon.
 *
 * @param   {Organization} organization       - Github Org model for the org whose docks just spun up
 * @param   {Organization} organization.login - Github Org name
 *
 * @returns {Promise} resolves when email request is done
 */
SendGridModel.prototype.dockCreated = function (organization) {
  var log = logger.child({
    method: 'SendGridModel.dockCreated',
    org: organization.login
  })
  log.info('SendGridModel.dockCreated called')
  return this.sendEmail({
    email: 'signup@runnable.com',
    from: process.env.SENDGRID_DOCK_CREATED_SENDER_EMAIL,
    fromname: process.env.SENDGRID_DOCK_CREATED_SENDER_NAME,
    body: 'This doesnt matter',
    htmlBody: 'This doesnt matter', // this is required so the html shows up
    subject: DOCK_CREATED_MESSAGES.en.subject,
    template: process.env.SENDGRID_DOCK_CREATED_TEMPLATE,
    substitutions: {
      '%org%': organization.login
    }
  })
    .catch(function (err) {
      log.error({
        err: err
      }, 'dockCreated failure')
      throw err
    })
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
SendGridModel.prototype.sendEmail = function (emailOptions) {
  var log = this.log
  log.info({
    emailOptions: emailOptions
  }, 'SendGridModel.prototype.sendEmail')

  if (!this._sendgrid) {
    // If sendGrid was never initialized, then return a failed promise
    var missingApiKeyError = new Error('SendGridModel model is missing a valid api key')
    log.error({
      err: missingApiKeyError
    }, 'sendEmail missing api key')
    return Promise.reject(missingApiKeyError)
  }

  var email = new this._sendgrid.Email({
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
    .catch(function (err) {
      log.error({
        err: err
      }, 'sendEmail failure')
      throw err
    })
}
