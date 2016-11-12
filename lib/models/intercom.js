'use strict'
require('loadenv')()

const IntercomApi = require('intercom.io')
// const log = require('logger').child({ module: 'intercom' })

class Intercom extends IntercomApi {

  // getUserByEmail (email) {
  //   return this.request('GET', 'users', userObj, cb);
  // };

  /**
   * Helper to send an email through Intercom when their infrastructure is ready.
   *
   * @param   {Object} user       - Intercom user object for Org Creator in BigPoppa
   *
   * @returns {Promise} resolves when email request is done
   */
  dockCreated (email) {
    // log.info({
    //   org: organization.login
    // }, 'dockCreated called')

    console.log({
      to: email
    }, 'dockCreated called')

    return this.viewUser({ email: email})
      .then((user) => {
        return this.createUserMessage({
          message_type: "email",
          subject: "Hey",
          body: "Ponies, cute small horses or something more sinister?",
          template: "plain",
          from: {
            type: "admin",
            id: "394051"
          },
          to: {
            type: "user",
            id: "536e564f316c83104c000020"
          }
        })
      })
  }


}

module.exports = new Intercom(process.env.INTERCOM_APP_ID, process.env.INTERCOM_API_KEY)
