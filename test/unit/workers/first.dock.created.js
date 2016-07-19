'use strict'

const chai = require('chai')
const FatalGithubError = require('notifications/github.status').FatalGithubError
const Github = require('models/github')
const SendGrid = require('models/sendgrid')
const Promise = require('bluebird')
const sinon = require('sinon')
const WorkerStopError = require('error-cat/errors/worker-stop-error')

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert
const Worker = require('workers/first.dock.created')

describe('First Dock Created', () => {
  describe('Worker', () => {
    beforeEach((done) => {
      sinon.stub(SendGrid.prototype, 'dockCreated').resolves(true)
      sinon.stub(Github.prototype, 'getUserByIdAsync').resolves()
      done()
    })

    afterEach((done) => {
      SendGrid.prototype.dockCreated.restore()
      Github.prototype.getUserByIdAsync.restore()
      done()
    })

    it('should fail if no github id is given', (done) => {
      Worker({}).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, WorkerStopError)
        assert.match(err.message, /Invalid job/i)
        done()
      })
    })

    it('should fail if no org comes back ', (done) => {
      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isDefined(err)
        assert.instanceOf(err, FatalGithubError)
        assert.match(err.message, /Org did not exist/i)
        sinon.assert.calledOnce(Github.prototype.getUserByIdAsync)
        sinon.assert.calledWith(Github.prototype.getUserByIdAsync, 23123213)
        done()
      })
    })
    it('should return WorkerStopError if email fails', function (done) {
      var org = {
        login: 'sadasd'
      }
      Github.prototype.getUserByIdAsync.resolves(org)

      var error = new Error('HEY')
      SendGrid.prototype.dockCreated.rejects(error)

      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isDefined(err)
        assert.match(err.message, /Failed to send email/)
        assert.instanceOf(err, WorkerStopError)
        done()
      })
    })
    it('should send email on success', function (done) {
      var org = {
        login: 'sadasd'
      }
      Github.prototype.getUserByIdAsync.resolves(org)

      Worker({ githubId: '23123213' }).asCallback((err) => {
        assert.isNotOk(err)
        sinon.assert.calledOnce(Github.prototype.getUserByIdAsync)
        sinon.assert.calledWith(Github.prototype.getUserByIdAsync, 23123213)
        sinon.assert.calledOnce(SendGrid.prototype.dockCreated)
        sinon.assert.calledWith(SendGrid.prototype.dockCreated, org)
        done()
      })
    })
  })
})
