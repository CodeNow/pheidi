'use strict'

var IntercomApi = require('intercom.io')

class Intercom {
  constructor (config) {
    this.intercom = new IntercomApi(config)

    // Override Intercom.io module to allow for user list sorting
    this.intercom.listCompanyUsers = function (companyObj, usersObj, cb) {
      if (companyObj && companyObj.hasOwnProperty('id')) {
        return this.request('GET', 'companies/' + companyObj.id + '/users', usersObj, cb)
      } else {
        return this.request('GET', 'companies', companyObj, cb)
      }
    }
  }

  /**
   * Gets the Intercom company given a GitHub Org name
   * @param {String} orgName - GitHub organization name
   * @returns {Promise} a promise containing the Intercom company object
   */
  getCompanyFromOrgName (orgName) {
    return this.intercom.listCompanies({name: orgName})
  }

  /**
   * Returns the first non-navi user from the list
   * @param {Array} userList - List of company users returned from Intercom
   * @returns {Promise} a promise containing the first user of a company
   */
  getFirstUserFromList (userList) {
    var user = userList.users[0]
    if (!user.name) {
      return userList.users[1]
    } else {
      return userList.users[0]
    }
  }

  /**
   * Gets the first user's email of an organization from Intercom
   * Fails over to 'signup@runnable.com' if something went wrong
   * @param {String} orgName - GitHub organization name
   * @returns {Promise} a promise containing the user's email address
   */
  getEmailFromOrgName (orgName) {
    return this.getCompanyFromOrgName(orgName)
      .then((company) => {
        return this.intercom.listCompanyUsers({id: company.id}, {order: 'desc'})
      })
      .then(this.getFirstUserFromList)
      .then((user) => {
        return user.email
      })
      .catch((err) => {
        console.log(err)
        return 'signup@runnable.com'
      })
  }

}

module.exports = Intercom
