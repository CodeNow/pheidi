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
const helper = require('sendgrid').mail
const isObject = require('101/is-object')
const joi = require('joi')

const log = require('logger').child({ module: 'sendgrid' })
const emailCopy = require('models/sendgrid-email-copy')

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
    const defaultOpts = SendGridModel._getDefaultEmailOptions(emailCopy.DOCK_CREATED_MESSAGES)
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
   * Send billing email
   *
   * @param   {String}                 organizationName   - Github Org name
   * @param   {String|Array<String>}   toEmail            - Email recipient or recipients
   * @param   {Object}                 options            - Default options for email
   * @param   {String}                 templateId         - Sendgrid template id (uuid)
   * @param   {Object}                 extraSubstitutions - More substitutions to add to the email
   *
   * @returns {Promise} resolves when email request is done
   */
  sendBillingEmail (organizationName, toEmail, options, templateId, extraSubstitutions) {
    log.info({
      organizationName,
      toEmail
    }, 'sendBillingEmail called')
    const defaultOpts = SendGridModel._getDefaultEmailOptions(options)
    return this.sendEmail(Object.assign(defaultOpts, {
      email: toEmail,
      template: templateId,
      category: ['billing'],
      substitutions: Object.assign({
        '%organizationName%': organizationName
      }, extraSubstitutions || {})
    }))
      .catch(SendGridModel.errorHandler.bind(this, 'sendBillingEmail'))
  }

  /**
   * Send notification email
   *
   * @param   {String}                 organizationName   - Github Org name
   * @param   {String|Array<String>}   toEmail            - Email recipient or recipients
   * @param   {Object}                 options            - Default options for email
   * @param   {String}                 templateId         - Sendgrid template id (uuid)
   * @param   {Object}                 extraSubstitutions - More substitutions to add to the email
   *
   * @returns {Promise} resolves when email request is done
   */
  sendNotificationEmail (organizationName, toEmail, options, templateId, extraSubstitutions) {
    log.info({
      organizationName,
      toEmail
    }, 'sendingNotificationEmail called')
    const defaultOpts = SendGridModel._getDefaultEmailOptions(options)
    return this.sendEmail(Object.assign(defaultOpts, {
      email: toEmail,
      template: templateId,
      category: ['notification'],
      substitutions: Object.assign({
        '%organizationName%': organizationName
      }, extraSubstitutions || {})
    }))
      .catch(SendGridModel.errorHandler.bind(this, 'sendingNotificationEmail'))
  }

  /**
   * Inform the card holder that their payment method has been added
   *
   * @param   {String}   organizationName        - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  paymentMethodAdded (organizationName, paymentMethodOwnerEmail) {
    log.info({
      organizationName,
      paymentMethodOwnerEmail
    }, 'paymentMethodAdded called')
    return this.sendBillingEmail(
      organizationName,
      paymentMethodOwnerEmail,
      emailCopy.PAYMENT_METHOD_ADDED,
      process.env.SENDGRID_PAYMENT_METHOD_ADDED_TEMPLATE
    )
  }

  /**
   * Inform the card holder that their payment method has been removed
   *
   * @param   {String}   organizationName        - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  paymentMethodRemoved (organizationName, paymentMethodOwnerEmail) {
    log.info({
      organizationName,
      paymentMethodOwnerEmail
    }, 'paymentMethodRemoved called')
    return this.sendBillingEmail(
      organizationName,
      paymentMethodOwnerEmail,
      emailCopy.PAYMENT_METHOD_REMOVED,
      process.env.SENDGRID_PAYMENT_METHOD_REMOVED_TEMPLATE
    )
  }

  /**
   * Inform the whole team that their trial is ending in 3 days
   *
   * @param   {String}          organizationName                   - Github Org name
   * @param   {Array<String>}   emailsForAllMembersOfOrganization - Emails for all members of the team
   *
   * @returns {Promise} resolves when email request is done
   */
  trialEnding (organizationName, emailsForAllMembersOfOrganization) {
    log.info({
      organizationName,
      emailsForAllMembersOfOrganization
    }, 'trialEnding called')
    return this.sendBillingEmail(
      organizationName,
      emailsForAllMembersOfOrganization,
      emailCopy.TRIAL_ENDING,
      process.env.SENDGRID_TRIAL_ENDING_TEMPLATE
    )
  }

  /**
   * Inform the whole team that their trial has ended
   *
   * @param   {String}          organizationName                   - Github Org name
   * @param   {Array<String>}   emailsForAllMembersOfOrganization - Emails for all members of the team
   *
   * @returns {Promise} resolves when email request is done
   */
  trialEnded (organizationName, emailsForAllMembersOfOrganization) {
    log.info({
      organizationName,
      emailsForAllMembersOfOrganization
    }, 'trialEnded called')
    return this.sendBillingEmail(
      organizationName,
      emailsForAllMembersOfOrganization,
      emailCopy.TRIAL_ENDED,
      process.env.SENDGRID_TRIAL_ENDED_TEMPLATE
    )
  }

  /**
   * Inform the admin/payment method owner that their plan has changed
   *
   * @param   {String}   organizationName        - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   * @param   {String}   currentPlanName         - Name of the current plan name ('Plus', 'Starter')
   * @param   {String}   curretnPlanCost         - String in dollars cents ('29.00') for current plan cost
   * @param   {String}   nextBillingDate         - String with date for next billing date ('1/1/2020')
   * @param   {String}   previousPlanName        - Name of the previous plan ('Plus', 'Starter')
   *
   * @returns {Promise} resolves when email request is done
   */
  planChanged (organizationName, paymentMethodOwnerEmail, currentPlanName, currentPlanCost, nextBillingDate, previousPlanName) {
    log.info({
      organizationName,
      paymentMethodOwnerEmail
    }, 'planChanged called')
    return this.sendBillingEmail(
      organizationName,
      paymentMethodOwnerEmail,
      emailCopy.PLAN_CHANGED,
      process.env.SENDGRID_PLAN_CHANGED_TEMPLATE,
      {
        '%currentPlanName%': currentPlanName,
        '%planCost%': currentPlanCost,
        '%billingDate%': nextBillingDate,
        '%previousPlanName%': previousPlanName
      }
    )
  }

 /**
   * Inform the admin/payment method owner that a billing error has occurred
   *
   * @param   {String}   organizationName        - Github Org name
   * @param   {String}   paymentMethodOwnerEmail - Contact email for payment method owner from Intercom
   *
   * @returns {Promise} resolves when email request is done
   */
  billingErrorToAdmin (organizationName, paymentMethodOwnerEmail) {
    log.info({
      organizationName,
      paymentMethodOwnerEmail
    }, 'billinggErrorToAdmin called')
    return this.sendBillingEmail(
      organizationName,
      paymentMethodOwnerEmail,
      emailCopy.BILLING_ERROR_ADMIN,
      process.env.SENDGRID_BILLING_ERROR_ADMIN_TEMPLATE
    )
  }

  /**
   * Inform the whole team that there has been a billing error
   *
   * @param   {String}          organizationName                   - Github Org name
   * @param   {Array<String>}   emailsForAllMembersOfOrganization - Emails for all members of the team
   *
   * @returns {Promise} resolves when email request is done
   */
  billingErrorToAllMembers (organizationName, emailsForAllMembersOfOrganization) {
    log.info({
      organizationName,
      emailsForAllMembersOfOrganization
    }, 'billinergErrorToAllMembers called')
    return this.sendBillingEmail(
      organizationName,
      emailsForAllMembersOfOrganization,
      emailCopy.BILLING_ERROR_ALL,
      process.env.SENDGRID_BILLING_ERROR_ALL_TEMPLATE
    )
  }

  /**
   * Send a welcome email to the customer who created the org
   *
   * @param   {String}   organizationName         - Github Org name
   * @param   {String}   organizationCreatorEmail - Email for user who created the organization
   * @param   {String}   userName                 - Github username of email recipient
   *
   * @returns {Promise} resolves when email request is done
   */
  welcomeEmailForOrganization (organizationName, organizationCreatorEmail, userName) {
    log.info({
      organizationName,
      organizationCreatorEmail,
      userName
    }, 'welcomeEmailForOrganization called')
    return this.sendNotificationEmail(
      organizationName,
      organizationCreatorEmail,
      emailCopy.WELCOME_EMAIL_FOR_ORGANIZATION,
      process.env.SENDGRID_WELCOME_EMAIL_FOR_ORGANIZATION_TEMPLATE,
      {
        '%userName%': userName
      }
    )
  }

  /**
   * Send a welcome email to the customer who created the org
   *
   * @param   {String}   organizationName       - Github Org name
   * @param   {String}   emailForNewlyAddedUser - Contact email for user who just joined organization
   * @param   {String}   userName               - Github username of email recipient
   *
   * @returns {Promise} resolves when email request is done
   */
  userAddedToOrganization (organizationName, emailForNewlyAddedUser, userName) {
    log.info({
      organizationName,
      emailForNewlyAddedUser,
      userName
    }, 'userAddedToOrganization called')
    return this.sendNotificationEmail(
      organizationName,
      emailForNewlyAddedUser,
      emailCopy.USER_ADDED_TO_ORG,
      process.env.SENDGRID_USER_ADDED_TO_ORG_TEMPLATE,
      {
        '%userName%': userName
      }
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
      const missingApiKeyError = new Error('Model is missing a valid api key')
      log.error({
        err: missingApiKeyError
      }, 'sendEmail missing api key')
      return Promise.reject(missingApiKeyError)
    }

    const email = new helper.Mail()

    // Set From Email and subject
    const fromEmail = new helper.Email(emailOptions.from, emailOptions.fromname)
    email.setFrom(fromEmail)
    email.setSubject(emailOptions.subject)

    // Set content
    const plainContent = new helper.Content('text/plain', emailOptions.body)
    email.addContent(plainContent)
    const htmlContent = new helper.Content('text/html', emailOptions.htmlBody)
    email.addContent(htmlContent)

    const addUserEmail = (userEmailAddress) => {
      log.trace({ userEmailAddress }, 'Add email')
      const personalization = new helper.Personalization()
      let userEmail = new helper.Email(userEmailAddress)
      personalization.addTo(userEmail)
      personalizations.push(personalization)
    }

    // Create Personalizations
    const personalizations = []
    if (Array.isArray(emailOptions.email)) {
      // Send email individually instead of sending them to the whole team
      emailOptions.email.forEach(addUserEmail)
    } else {
      addUserEmail(emailOptions.email)
    }

    // If the email has substitution values, add them.  The keys should be surrounded by % like %key%
    if (isObject(emailOptions.substitutions)) {
      Object.keys(emailOptions.substitutions).forEach(function (key) {
        let substitution = new helper.Substitution(key, emailOptions.substitutions[key])
        personalizations.forEach((p) => {
          p.addSubstitution(substitution)
        })
      })
    }
    personalizations.forEach(email.addPersonalization.bind(email))

    // If the email has a template, add it
    if (emailOptions.template) {
      email.setTemplateId(emailOptions.template)
    }

    // Actually make the sendGrid api call
    const request = this._sendgrid.emptyRequest({
      method: 'POST',
      path: '/v3/mail/send',
      body: email.toJSON()
    })
    return this._sendgrid.API(request)
  }
}
