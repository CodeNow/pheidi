'use strict'

require('loadenv')()

const ErrorCat = require('error-cat')
const hermes = require('runnable-hermes')
const log = require('logger').child({ module: 'hermes' })
const Promise = require('bluebird')

/**
 * Hermes singelton instance.
 * @type {Hermes}
 */
const client = hermes.hermesSingletonFactory({
  name: process.env.APP_NAME,
  hostname: process.env.RABBITMQ_HOSTNAME,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  password: process.env.RABBITMQ_PASSWORD,
  subscribedEvents: [
    'instance.deployed',
    'instance.updated'
  ]
})

/**
 * Handles errors for the hermes client.
 * @param {Error} The error to handle.
 */
client.on('error', (err) => {
  log.error({ err: err }, 'Hermes client encountered an error')
  ErrorCat.report(err)
})

/**
 * Hermes internal singelton instance.
 * @type {Hermes}
 */
const internalClient = hermes.hermesSingletonFactory({
  name: process.env.APP_NAME,
  hostname: process.env.RABBITMQ_HOSTNAME,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  password: process.env.RABBITMQ_PASSWORD,
  // only one job at a time: prevent race-condition
  prefetch: 1,
  queues: [
    'github.bot.notify'
  ]
})

/**
 * Handles errors for the hermes client.
 * @param {Error} The error to handle.
 */
internalClient.on('error', (err) => {
  log.error({ err: err }, 'Hermes internalClient encountered an error')
  ErrorCat.report(err)
})

/**
 * Hermes client for use by Pheidi.
 * @module rabbitmq
 */
module.exports.client = Promise.promisifyAll(client)
module.exports.internalClient = Promise.promisifyAll(internalClient)

/**
 * Publish `github.bot.notify` command
 * @param {Object} data job payload
 */
module.exports.publishGitHubBotNotify = function (data) {
  internalClient.publish('github.bot.notify', data)
}
