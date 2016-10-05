'use strict'

const chai = require('chai')
const bigPoppa = require('models/big-poppa')
const SendGrid = require('models/sendgrid')
const mongoClient = require('mongo-helper').client
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const Worker = require('workers/first.dock.created').task

describe('First Dock Created', () => {
  describe('Worker', () => {
    let orgs
    let user
    const organizationName = 'CodeNow'
    const userName = 'thejsj'
    const userEmail = 'jorge.silva@thejsj.com'
    const creatorId = 100

    beforeEach((done) => {
      orgs = [{
        name: organizationName,
        creator: {
          id: creatorId
        }
      }]
      user = {
        email: userEmail,
        accounts: {
          github: {
            username: userName
          }
        }
      }
      sinon.stub(bigPoppa, 'getOrganizations').resolves(orgs)
      sinon.stub(mongoClient, 'findOneUserAsync').resolves(user)
      sinon.stub(SendGrid.prototype, 'dockCreated').resolves(true)
      done()
    })

    afterEach((done) => {
      SendGrid.prototype.dockCreated.restore()
      mongoClient.findOneUserAsync.restore()
      bigPoppa.getOrganizations.restore()
      done()
    })

    it('should fail if no org comes back ', (done) => {
      bigPoppa.getOrganizations.resolves([])

      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /Org did not exist in bigPoppa./i)
        sinon.assert.calledOnce(bigPoppa.getOrganizations)
        sinon.assert.calledWith(bigPoppa.getOrganizations, { githubId: '23123213' })
        done()
      })
    })
    it('should return WorkerStopError if email fails', function (done) {
      var error = new Error('HEY')
      SendGrid.prototype.dockCreated.rejects(error)

      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isDefined(err)
        assert.match(err.message, /Failed to send email/)
        assert.instanceOf(err, WorkerStopError)
        done()
      })
    })
    it('should send email on success with string id', function (done) {
      var org = {
        login: organizationName,
        email: userEmail
      }

      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isNotOk(err)
        sinon.assert.calledOnce(bigPoppa.getOrganizations)
        sinon.assert.calledWith(bigPoppa.getOrganizations, { githubId: '23123213' })
        sinon.assert.calledOnce(SendGrid.prototype.dockCreated)
        sinon.assert.calledWith(SendGrid.prototype.dockCreated, org)
        done()
      })
    })
    it('should send email on success with number id', function (done) {
      Worker({ githubId: 23123213 }).asCallback((err) => {
        assert.isNotOk(err)
        done()
      })
    })
  })
})
