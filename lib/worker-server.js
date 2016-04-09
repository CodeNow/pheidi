'use strict'

require('loadenv')()

const rabbitmq = require('./rabbitmq')
const log = require('./logger').child({ module: 'worker/server' })
const ponos = require('ponos')

/**
 * The pheidi ponos server.
 * @type {ponos~Server}
 * @module pheidi/worker-server
 */
const server = module.exports = new ponos.Server({
  hermes: rabbitmq,
  log: log
})
server.setTask('instance.deployed', require('./workers/instance.deployed'))
