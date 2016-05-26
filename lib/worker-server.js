'use strict'

require('loadenv')()

const rabbitmq = require('./rabbitmq')
const log = require('logger').child({ module: 'worker-server' })
const ponos = require('ponos')

/**
 * The pheidi ponos server.
 * @type {ponos~Server}
 * @module pheidi/worker-server
 */
const server = module.exports = new ponos.Server({
  hermes: rabbitmq.client,
  log: log
})
server.setTask('container.life-cycle.died', require('./workers/container.life-cycle.died'))
server.setTask('container.life-cycle.started', require('./workers/container.life-cycle.started'))
server.setTask('instance.deleted', require('./workers/instance.deleted'))
server.setTask('instance.deployed', require('./workers/instance.deployed'))
server.setTask('instance.updated', require('./workers/instance.updated'))
