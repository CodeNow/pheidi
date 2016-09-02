'use strict'

const mongoClient = require('mongo-helper').client
const bigPoppa = require('util/big-poppa')

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

}
