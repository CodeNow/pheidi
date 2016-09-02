'use strict'

require('loadenv')({ debugName: 'pheidi:test' })

// external
const chai = require('chai')
const fs = require('fs')
const MongoClient = require('mongodb').MongoClient
const sinon = require('sinon')

// internal (being tested)
const MongoDB = require('models/mongo')

const assert = chai.assert

describe('Mongo Model', function () {
  const prevCACert = process.env.MONGO_CACERT
  const prevCert = process.env.MONGO_CERT
  const prevKey = process.env.MONGO_KEY

  beforeEach(function () {
    delete process.env.MONGO_CACERT
    delete process.env.MONGO_CERT
    delete process.env.MONGO_KEY
  })

  afterEach(function () {
    process.env.MONGO_CACERT = prevCACert
    process.env.MONGO_CERT = prevCert
    process.env.MONGO_KEY = prevKey
  })

  describe('constructor', function () {
    beforeEach(function () {
      sinon.stub(fs, 'readFileSync').returnsArg(0)
    })

    afterEach(function () {
      fs.readFileSync.restore()
    })

    describe('with certificates', function () {
      beforeEach(function () {
        process.env.MONGO_CACERT = 'cacert'
        process.env.MONGO_CERT = 'cert'
        process.env.MONGO_KEY = 'key'
      })

      it('should read the certificates', function () {
        const m = new MongoDB()
        assert.ok(m)
        sinon.assert.calledThrice(fs.readFileSync)
        sinon.assert.calledWith(fs.readFileSync, 'cacert')
        sinon.assert.calledWith(fs.readFileSync, 'cert')
        sinon.assert.calledWith(fs.readFileSync, 'key')
      })
    })

    it('should not read certs by default', function () {
      const m = new MongoDB()
      assert.ok(m)
      sinon.assert.notCalled(fs.readFileSync)
    })
  })

  describe('connect', function () {
    var m

    beforeEach(function () {
      sinon.stub(MongoClient, 'connect').yieldsAsync()
      sinon.stub(fs, 'readFileSync').returnsArg(0)
      m = new MongoDB()
    })

    afterEach(function () {
      MongoClient.connect.restore()
      fs.readFileSync.restore()
    })

    describe('with certificates', function () {
      beforeEach(function () {
        process.env.MONGO_CACERT = 'cacert'
        process.env.MONGO_CERT = 'cert'
        process.env.MONGO_KEY = 'key'
        m = new MongoDB()
      })

      it('should create a client with the certificates', function () {
        m.connect()
        sinon.assert.calledOnce(MongoClient.connect)
        sinon.assert.calledWithExactly(
          MongoClient.connect,
          sinon.match.string,
          {
            server: {
              ssl: true,
              sslValidate: true,
              sslCA: 'cacert',
              sslKey: 'key',
              sslCert: 'cert'
            }
          },
          sinon.match.func
        )
      })
    })

    it('should create a client', function () {
      m.connect()
      sinon.assert.calledOnce(MongoClient.connect)
      sinon.assert.calledWithExactly(
        MongoClient.connect,
        sinon.match.string,
        {},
        sinon.match.func
      )
    })
  })

  describe('#getUserEmailByGithubId', () => {
    const githubId = 1981198
    const userEmail = 'jorge@runnable.com'
    const user = {
      email: userEmail
    }
    let client
    beforeEach(function () {
      client = new MongoDB()
      sinon.stub(MongoDB.prototype, 'findOneUserAsync').resolves(user)
    })
    afterEach(function () {
      MongoDB.prototype.findOneUserAsync.restore()
    })

    it('should fint the user by its githubid', (done) => {
      client.getUserEmailByGithubId(githubId)
        .then(() => {
          sinon.assert.calledOnce(MongoDB.prototype.findOneUserAsync)
          sinon.assert.calledWithExactly(MongoDB.prototype.findOneUserAsync, { 'accounts.github.id': githubId })
        })
        .asCallback(done)
    })

    it('should return the user', (done) => {
      client.getUserEmailByGithubId(githubId)
        .then((returnedUserEmail) => {
          assert.equal(returnedUserEmail, userEmail)
        })
        .asCallback(done)
    })

    it('should return `null` if there is no user', (done) => {
      MongoDB.prototype.findOneUserAsync.resolves(undefined)

      client.getUserEmailByGithubId(githubId)
        .then((returnedUserEmail) => {
          assert.equal(returnedUserEmail, null)
        })
        .asCallback(done)
    })

    it('should return `null` if there is no user email', (done) => {
      MongoDB.prototype.findOneUserAsync.resolves({ email: undefined })

      client.getUserEmailByGithubId(githubId)
        .then((returnedUserEmail) => {
          assert.equal(returnedUserEmail, null)
        })
        .asCallback(done)
    })
  })

  describe('#getUserEmailsByGithubIds', () => {
    let client
    let users
    const email1 = 'jorge.silva@thejsj.com'
    const email2 = 'jorge.silva.jetter@gmail.com'
    const githubIds = [1981198, 897654]
    beforeEach(() => {
      users = [{ email: email1 }, { email: email2 }]
      client = new MongoDB()
      sinon.stub(MongoDB.prototype, 'findUsersAsync').resolves(users)
    })
    afterEach(() => {
      MongoDB.prototype.findUsersAsync.restore()
    })

    it('should call `findUsersAsync`', (done) => {
      client.getUserEmailsByGithubIds(githubIds)
        .then(() => {
          sinon.assert.calledOnce(MongoDB.prototype.findUsersAsync)
          sinon.assert.calledWithExactly(
            MongoDB.prototype.findUsersAsync,
            { 'accounts.github.id': { $in: githubIds } }
          )
        })
        .asCallback(done)
    })

    it('should return the user emails', (done) => {
      client.getUserEmailsByGithubIds()
        .then((emails) => {
          console.log(emails)
          assert.isArray(emails)
          assert.lengthOf(emails, 2)
          assert.include(emails, email1)
          assert.include(emails, email2)
        })
        .asCallback(done)
    })

    it('should return an empty array if no users are found', (done) => {
      MongoDB.prototype.findUsersAsync.resolves([])

      client.getUserEmailsByGithubIds()
        .then((emails) => {
          assert.isArray(emails)
          assert.lengthOf(emails, 0)
        })
        .asCallback(done)
    })

    it('should return an empty array if users have no emails', (done) => {
      MongoDB.prototype.findUsersAsync.resolves([{}, {}, {}])

      client.getUserEmailsByGithubIds()
        .then((emails) => {
          assert.isArray(emails)
          assert.lengthOf(emails, 0)
        })
        .asCallback(done)
    })
  })
})
