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

const Intercom = require('./intercom')

// module.exports = Test

function Test () {
  this._intercom = new Intercom({
    appId: 'wqzm3rju',
    apiKey: 'ef28806417aef605ca74573ff080c9d5eb0d6384'
  })
}

Test.prototype.something = function (orgName) {
  this._intercom.getEmailFromOrgName(orgName)
    .then(console.log)
}

var poop = new Test()
poop.something('gogits')
