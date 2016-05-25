/**
 * Exports a singleton instance of the Mongodb class. Wrapper methods for
 * database operations.
 * @module lib/models/mongo
 */
'use strict'

require('loadenv')({ debugName: 'pheidi:mongod' })

const Promise = require('bluebird')
// external
const assign = require('101/assign')
const fs = require('fs')
const MongoClient = require('mongodb').MongoClient

// internal
const datadog = require('monitor-dog')
const log = require('logger').child({
  module: 'mongo'
})

module.exports = Mongodb

var ca
var key
var cert

/**
 * @class
 */
function Mongodb () {
  this.host = process.env.MONGO
  this.db = null

  if (process.env.MONGO_CACERT &&
      process.env.MONGO_CERT &&
      process.env.MONGO_KEY
  ) {
    try {
      log.info('loading mongodb certificates')
      ca = ca || fs.readFileSync(process.env.MONGO_CACERT, 'utf-8')
      key = key || fs.readFileSync(process.env.MONGO_KEY, 'utf-8')
      cert = cert || fs.readFileSync(process.env.MONGO_CERT, 'utf-8')
      this.ssl = {
        ssl: true,
        sslValidate: true,
        sslCA: ca,
        sslKey: key,
        sslCert: cert
      }
    } catch (err) {
      log.fatal({
        err: err
      }, 'could not read provided mongo certificates')
    }
  }
}

Mongodb.prototype.connect = function (cb) {
  log.info({ mongodbHost: this.host }, 'Mongodb.prototype.connect')
  var opts = {}
  if (this.ssl) {
    opts = assign(opts, { server: this.ssl })
    log.trace('mongodb connecting with ssl')
  } else {
    log.warn('mongdb connecting without ssl')
  }
  const timer = datadog.timer('connect')
  MongoClient.connect(this.host, opts, function (err, db) {
    if (err) {
      log.error({
        host: this.host,
        err: err
      }, 'Mongodb.prototype.connect connect error')
      return cb(err)
    }
    log.trace({ host: this.host }, 'Mongodb.prototype.connect connect success')
    timer.stop()
    this.db = db
    cb()
  }.bind(this))
}

Mongodb.prototype.close = function (cb) {
  this.db.close(cb)
}

/**
 * initialize wrapped collection fetch
 */
;[
  'ContextVersions',
  'Instances',
  'Settings',
  'Users'
].forEach(function collectionFindOne (collectionName) {
  const singularName = collectionName.slice(0, collectionName.length - 1)
  const functionName = 'findOne' + singularName
  Mongodb.prototype[functionName] = function (query, cb) {
    const collection = this.db.collection(collectionName.toLowerCase())
    const timer = datadog.timer(functionName)
    collection
      .findOne(query, function (err, doc) {
        if (err) {
          log.error({
            collection: collectionName,
            err: err
          }, 'Monogodb.prototype[functionName] findOne failed')
        }
        timer.stop()
        cb(null, doc)
      })
  }
})

Promise.promisifyAll(Mongodb.prototype)
