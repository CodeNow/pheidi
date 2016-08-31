'use strict'

require('loadenv')({ debugName: 'pheidi:test' })

var chai = require('chai')
var assert = chai.assert
chai.use(require('chai-as-promised'))

// external
var Promise = require('bluebird')
var sinon = require('sinon')

// internal
var MongoDB = require('models/mongo')

// internal (being tested)
var mongodbHelper = require('mongo-helper')
var mongoClient = require('mongo-helper').client

describe('MongoDB Helper', function () {
  describe('#helper', () => {
    beforeEach(function () {
      sinon.stub(MongoDB.prototype, 'close').yieldsAsync()
      sinon.stub(MongoDB.prototype, 'connect').yieldsAsync()
    })
    afterEach(function () {
      MongoDB.prototype.close.restore()
      MongoDB.prototype.connect.restore()
    })

    it('should return a client for Promise.using', function () {
      var mongodbPromise = mongodbHelper.helper()
      return assert.isFulfilled(
        Promise.using(mongodbPromise, function (client) {
          assert.ok(client)
          assert.instanceOf(client, MongoDB)
          sinon.assert.calledOnce(MongoDB.prototype.connect)
          sinon.assert.notCalled(MongoDB.prototype.close)
        })
      )
    })

    it('should close the client if it was being used', function () {
      var mongodbPromise = mongodbHelper.helper()
      return assert.isRejected(
        Promise.using(mongodbPromise, function (client) {
          assert.ok(client)
          assert.instanceOf(client, MongoDB)
          sinon.assert.calledOnce(MongoDB.prototype.connect)
          throw new Error('innerError')
        }),
        Error,
        'innerError'
      )
        .then(function () {
          sinon.assert.calledOnce(MongoDB.prototype.close)
        })
    })

    it('should log an error if the client fails to close, but return true', function () {
      MongoDB.prototype.close.yieldsAsync(new Error('foobar'))
      var mongodbPromise = mongodbHelper.helper()
      return assert.isFulfilled(
        Promise.using(mongodbPromise, function () {
          return 1
        })
      )
        .then(function (result) {
          // we don't actually get to see the error happen, and that's the point
          sinon.assert.calledOnce(MongoDB.prototype.close)
          assert.equal(result, 1)
        })
    })
  })

  describe.only('#getUserEmailByGithubId', () => {
    const githubId = 1981198
    const userEmail = 'jorge@runnable.com'
    const user = {
      email: userEmail
    }
    beforeEach(function () {
      sinon.stub(mongodbHelper, 'helper').resolves(new MongoDB())
      sinon.stub(MongoDB.prototype, 'findOneUserAsync').resolves(user)
    })
    afterEach(function () {
      mongodbHelper.helper.restore()
      MongoDB.prototype.findOneUserAsync.restore()
    })

    it('should fint the user by its githubid', (done) => {
      mongoClient.getUserEmailByGithubId(githubId)
        .then(() => {
          sinon.assert.calledOnce(MongoDB.prototype.findOneUserAsync)
          sinon.assert.calledWithExactly(MongoDB.prototype.findOneUserAsync, { 'accounts.github.id': githubId })
        })
        .asCallback(done)
    })

    it('should return the user', (done) => {
      mongoClient.getUserEmailByGithubId(githubId)
        .then((returnedUserEmail) => {
          assert.equal(returnedUserEmail, userEmail)
        })
        .asCallback(done)
    })

    it('should return `null` if there is no user', (done) => {
      MongoDB.prototype.findOneUserAsync.resolves(undefined)

      mongoClient.getUserEmailByGithubId(githubId)
        .then((returnedUserEmail) => {
          assert.equal(returnedUserEmail, null)
        })
        .asCallback(done)
    })

    it('should return `null` if there is no user email', (done) => {
      MongoDB.prototype.findOneUserAsync.resolves({ email: undefined })

      mongoClient.getUserEmailByGithubId(githubId)
        .then((returnedUserEmail) => {
          assert.equal(returnedUserEmail, null)
        })
        .asCallback(done)
    })
  })
})
