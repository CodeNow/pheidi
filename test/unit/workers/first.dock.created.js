'use strict'

const chai = require('chai')
const bigPoppa = require('models/big-poppa')
const orion = require('@runnable/orion')
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
    let userInBigPoppa
    let userInIntercom
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
      userInBigPoppa = {
        email: userEmail,
        accounts: {
          github: {
            username: userName
          }
        }
      }
      userInIntercom = {
        body: {
          id: 'thejsj'
        }
      }

      sinon.stub(bigPoppa, 'getOrganizations').resolves(orgs)
      sinon.stub(mongoClient, 'findOneUserAsync').resolves(userInBigPoppa)
      sinon.stub(orion.users, 'find').resolves(userInIntercom)
      sinon.stub(orion.messages, 'create').resolves()
      done()
    })

    afterEach((done) => {
      orion.users.find.restore()
      orion.messages.create.restore()
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
      orion.messages.create.rejects(error)

      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isDefined(err)
        assert.match(err.message, /Failed to communicate with Intercom/)
        assert.instanceOf(err, WorkerStopError)
        done()
      })
    })

    it('should send email on success with string id', function (done) {
      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isNotOk(err)
        sinon.assert.calledOnce(bigPoppa.getOrganizations)
        sinon.assert.calledWith(bigPoppa.getOrganizations, { githubId: '23123213' })
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
