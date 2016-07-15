'use strict'

require('loadenv')()

const log = require('logger').child({ module: 'rabbitmq' })
const RabbitMQ = require('ponos/lib/rabbitmq')

/**
 * Rabbitmq internal singelton instance.
 * @type {rabbitmq}
 */
const publisher = new RabbitMQ({
  name: process.env.APP_NAME,
  hostname: process.env.RABBITMQ_HOSTNAME,
  port: process.env.RABBITMQ_PORT,
  prefetch:  process.env.PHEIDI_PREFETCH || 3,
  username: process.env.RABBITMQ_USERNAME,
  password: process.env.RABBITMQ_PASSWORD
})

module.exports.publisher = publisher

/**
 * Publish `github.bot.notify` command
 * @param {Object} data job payload
 */
module.exports.publishGitHubBotNotify = function (data) {
  log.info(data, 'publish github.bot notify job')
  return publisher.publishTask('github.bot.notify', data)
}
