'use strict'

require('loadenv')({ debugName: 'pheidi:test' })

// external
var chai = require('chai')
var fs = require('fs')
var MongoClient = require('mongodb').MongoClient
var sinon = require('sinon')

// internal (being tested)
var MongoDB = require('models/mongo')

var assert = chai.assert

describe('Mongo Model', function () {
  var prevCACert = process.env.MONGO_CACERT
  var prevCert = process.env.MONGO_CERT
  var prevKey = process.env.MONGO_KEY

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
        var m = new MongoDB()
        assert.ok(m)
        sinon.assert.calledThrice(fs.readFileSync)
        sinon.assert.calledWith(fs.readFileSync, 'cacert')
        sinon.assert.calledWith(fs.readFileSync, 'cert')
        sinon.assert.calledWith(fs.readFileSync, 'key')
      })
    })

    it('should not read certs by default', function () {
      var m = new MongoDB()
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
})
