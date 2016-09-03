'use strict'

require('loadenv')()

const log = require('logger').child({ module: 'worker-server' })
const ponos = require('ponos')
const GitHubBotNotify = require('./workers/github.bot.notify')
const ContainerDied = require('./workers/container.life-cycle.died')
const ContainerStarted = require('./workers/container.life-cycle.started')
const FirstDockCreated = require('./workers/first.dock.created')
const InstanceDeleted = require('./workers/instance.deleted')
const InstanceDeployed = require('./workers/instance.deployed')
const InstanceUpdated = require('./workers/instance.updated')
const NotifyPaymentMethodAdded = require('./workers/organization.payment-method.added')
const NotifyPaymentMethodRemoved = require('./workers/organization.payment-method.removed')
const NotifyTrialEnding = require('./workers/organization.trial.ending')
const NotifyTrialEned = require('./workers/organization.trial.ended')

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
    'github.bot.notify': GitHubBotNotify
  },
  events: {
    'container.life-cycle.died': ContainerDied,
    'container.life-cycle.started': ContainerStarted,
    'first.dock.created': FirstDockCreated,
    'instance.deleted': InstanceDeleted,
    'instance.deployed': InstanceDeployed,
    'instance.updated': InstanceUpdated,
    'organization.payment-method.added': NotifyPaymentMethodAdded,
    'organization.payment-method.removed': NotifyPaymentMethodRemoved,
    'organization.trial.ending': NotifyTrialEnding,
    'organization.trial.ended': NotifyTrialEned
  }
})
