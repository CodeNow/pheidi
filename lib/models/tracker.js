/**
 * Shared LRU caching object used for keeping track of external calls
 * @module lib/tracker
 */
'use strict'

const LRU = require('lru-cache')
const monitor = require('monitor-dog')

const cache = LRU({
  max: 50000,
  maxAge: 1000 * 60 * 2, // 2 minutes
  dispose: function (key, item) {
    monitor.increment('lru.dispose', {
      key: key
    })
  }
})

module.exports = cache
