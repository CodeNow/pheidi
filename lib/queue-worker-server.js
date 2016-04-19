'use strict'

require('loadenv')()

const rabbitmq = require('./rabbitmq')
const log = require('logger').child({ module: 'server' })
const ponos = require('ponos')

/**
 * The pheidi queued ponos server: process one job at a time to avoid race condition
 * @type {ponos~Server}
 * @module pheidi/queue-worker-server
 */
const server = module.exports = new ponos.Server({
  hermes: rabbitmq.internalClient,
  log: log
})
server.setTask('github.bot.notify', require('./workers/github.bot.notify'))
