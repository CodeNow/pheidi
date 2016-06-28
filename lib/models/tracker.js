/**
 * Shared LRU caching object used for keeping track of external calls
 * @module lib/cache
 */
'use strict'

const LRU = require('lru-cache')
const monitor = require('monitor-dog')

const log = require('logger').child({ module: 'tracker' })

const cache = LRU({
  max: 50000,
  maxAge: 1000 * 60 * 3, // 3 minutes
  dispose: function (key, item) {
    log.trace({
      key: key
    }, 'LRU dispose')
    monitor.increment('pheidi.lru.dispose', {
      key: key
    })
  }
})

module.exports = cache
