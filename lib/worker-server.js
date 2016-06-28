'use strict'

require('loadenv')()

const log = require('logger').child({ module: 'worker-server' })
const ponos = require('ponos')

/**
 * The pheidi ponos server.
 * @type {ponos~Server}
 * @module pheidi/worker-server
 */
module.exports = new ponos.Server({
  name: process.env.APP_NAME,
  rabbitmq: {
    hostname: process.env.RABBITMQ_HOSTNAME,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD
  },
  log: log,
  events: {
    'container.life-cycle.died': require('./workers/container.life-cycle.died'),
    'container.life-cycle.started': require('./workers/container.life-cycle.started'),
    'github.bot.notify': require('./workers/github.bot.notify'),
    'instance.deleted': require('./workers/instance.deleted'),
    'instance.deployed': require('./workers/instance.deployed'),
    'instance.updated': require('./workers/instance.updated')
  }
})
