'use strict'

const mongoClient = require('mongo-helper').client
const bigPoppa = require('models/big-poppa')

module.exports = class OrganizationService {

  /**
   * Get all user emails for an organization
   *
   * @param {Number} orgId - Big Poppa id for organization
   * @resloves {Array<String>} emails - All user emails found for organization
   * @returns {Promise}
   */
  static getAllUserEmailsForOrganization (orgId) {
    return bigPoppa.getOrganization(orgId)
      .then(function getGithubIdsFor (org) {
        if (Array.isArray(org.users)) {
          return org.users.map((x) => x.githubId)
        }
        return []
      })
      .then(function fetchUsersFromMongo (userGithubIds) {
        return mongoClient.getUserEmailsByGithubIds(userGithubIds)
      })
  }

  /**
   * Get hasPaymentMethod for an organization
   *
   * @param {Number} orgId - Big Poppa Id for organization
   * @resolves {Boolean} hasPaymentMethod is true/false for organization
   * @returns {Promse}
   */
  static getHasPaymentMethodForOrganization (orgId) {
    return bigPoppa.getOrganization(orgId)
      .then((org) => {
        return org.hasPaymentMethod
      })
  }

}
