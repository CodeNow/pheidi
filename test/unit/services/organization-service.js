'use strict'

require('loadenv')({ debugName: 'pheidi:test' })

// external
const chai = require('chai')
const sinon = require('sinon')

const MongoDB = require('models/mongo')
const bigPoppa = require('models/big-poppa')

// internal (being tested)
const OrganizationService = require('services/organization-service')

const assert = chai.assert

describe('OrganizationService', function () {
  const orgId = 2335750
  const githubId1 = 1981198
  const githubId2 = 1777777
  const email1 = 'jorge.silva@thejsj.com'
  const email2 = 'jorge.silva.jetter@gmail.com'
  let emails
  let org

  beforeEach(() => {
    emails = [email1, email2]
    org = {
      users: [{ githubId: githubId1 }, { githubId: githubId2 }]
    }
    sinon.stub(MongoDB.prototype, 'getUserEmailsByGithubIds').resolves(emails)
    sinon.stub(bigPoppa, 'getOrganization').resolves(org)
  })
  afterEach(() => {
    MongoDB.prototype.getUserEmailsByGithubIds.restore()
    bigPoppa.getOrganization.restore()
  })

  describe('getAllUserEmailsForOrganization', () => {
    it('should get the organization', (done) => {
      OrganizationService.getAllUserEmailsForOrganization(orgId)
        .then(() => {
          sinon.assert.calledOnce(bigPoppa.getOrganization)
          sinon.assert.calledWithExactly(bigPoppa.getOrganization, orgId)
        })
        .asCallback(done)
    })

    it('should fetch the emails for the organization', (done) => {
      OrganizationService.getAllUserEmailsForOrganization(orgId)
        .then(() => {
          sinon.assert.calledOnce(MongoDB.prototype.getUserEmailsByGithubIds)
          sinon.assert.calledWithExactly(
            MongoDB.prototype.getUserEmailsByGithubIds,
            [githubId1, githubId2]
          )
        })
        .asCallback(done)
    })

    it('should return an array of emails', (done) => {
      OrganizationService.getAllUserEmailsForOrganization(orgId)
        .then((emails) => {
          assert.isArray(emails)
          assert.lengthOf(emails, 2)
          assert.include(emails, email1)
          assert.include(emails, email2)
        })
        .asCallback(done)
    })

    it('should return an empty array if there are no users', (done) => {
      bigPoppa.getOrganization.resolves({ users: [] })
      MongoDB.prototype.getUserEmailsByGithubIds.resolves([])

      OrganizationService.getAllUserEmailsForOrganization(orgId)
        .then((emails) => {
          sinon.assert.calledOnce(MongoDB.prototype.getUserEmailsByGithubIds)
          sinon.assert.calledWithExactly(
            MongoDB.prototype.getUserEmailsByGithubIds,
            []
          )
          assert.isArray(emails)
          assert.lengthOf(emails, 0)
        })
        .asCallback(done)
    })
  })
})
