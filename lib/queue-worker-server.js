'use strict'

require('loadenv')()

const log = require('logger').child({ module: 'queue-worker-server' })
const ponos = require('ponos')

/**
 * The pheidi queued ponos server: process one job at a time to avoid race condition
 * @type {ponos~Server}
 * @module pheidi/queue-worker-server
 */
module.exports = new ponos.Server({
  name: process.env.APP_NAME,
  rabbitmq: {
    hostname: process.env.RABBITMQ_HOSTNAME,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD,
    // only one job at a time: prevent race-condition
    prefetch: 1
  },
  log: log,
  tasks: {
    'github.bot.notify': require('./workers/github.bot.notify')
  }
})
