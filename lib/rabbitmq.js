'use strict'

require('loadenv')()

const ErrorCat = require('error-cat')
const Hermes = require('runnable-hermes')
const log = require('logger').child({ module: 'hermes' })
const Promise = require('bluebird')
const RabbitMQ = require('ponos/lib/rabbitmq')

/**
 * Hermes internal singelton instance.
 * @type {Hermes}
 */
const publisher = new RabbitMQ({
  name: process.env.APP_NAME,
  hostname: process.env.RABBITMQ_HOSTNAME,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  password: process.env.RABBITMQ_PASSWORD
})


module.exports.publisher = publisher

/**
 * Publish `github.bot.notify` command
 * @param {Object} data job payload
 */
module.exports.publishGitHubBotNotify = function (data) {
  publisher.publishToQueue('github.bot.notify', data)
}
