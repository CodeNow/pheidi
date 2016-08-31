'use strict'

require('loadenv')()

const log = require('logger').child({ module: 'worker-server' })
const ponos = require('ponos')
const InstanceUpdated = require('./workers/instance.updated')
const InstanceUpdate = require('./workers/instance.updated')
const NotifyPaymentMethodAdded = require('./workers/organization.payment-method.added')
const NotifyPaymentMethodRemoved = require('./workers/organization.payment-method.removed')

/**
 * The pheidi ponos server.
 * @type {ponos~Server}
 * @module pheidi/worker-server
 */
module.exports = new ponos.Server({
  name: process.env.APP_NAME,
  rabbitmq: {
    channel: {
      prefetch: process.env.PHEIDI_PREFETCH
    },
    hostname: process.env.RABBITMQ_HOSTNAME,
    port: process.env.RABBITMQ_PORT,
    username: process.env.RABBITMQ_USERNAME,
    password: process.env.RABBITMQ_PASSWORD
  },
  log: log,
  tasks: {
    'github.bot.notify': require('./workers/github.bot.notify')
  },
  events: {
    'container.life-cycle.died': require('./workers/container.life-cycle.died'),
    'container.life-cycle.started': require('./workers/container.life-cycle.started'),
    'first.dock.created': require('./workers/first.dock.created'),
    'instance.deleted': require('./workers/instance.deleted'),
    'instance.deployed': require('./workers/instance.deployed'),
    'instance.updated': InstanceUpdated,
    'organization.payment-method.added': NotifyPaymentMethodAdded,
    'organization.payment-method.removed': NotifyPaymentMethodRemoved
  }
})
