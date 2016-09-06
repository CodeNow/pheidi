'use strict'

require('loadenv')()

const log = require('logger').child({ module: 'rabbitmq' })
const RabbitMQ = require('ponos/lib/rabbitmq')
const GithubBotNotifyWorker = require('./workers/github.bot.notify')

/**
 * Rabbitmq internal singelton instance.
 * @type {rabbitmq}
 */
const publisher = new RabbitMQ({
  name: process.env.APP_NAME,
  hostname: process.env.RABBITMQ_HOSTNAME,
  port: process.env.RABBITMQ_PORT,
  username: process.env.RABBITMQ_USERNAME,
  password: process.env.RABBITMQ_PASSWORD,
  tasks: [{
    name: 'github.bot.notify',
    jobSchema: GithubBotNotifyWorker.jobSchema
  }]
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

/**
 * Publish `github.bot.notify` command
 * @param {Object} data job payload
 */
module.exports.publishRunnabotEnabled = function (data) {
  log.info(data, 'publish organization.integration.runnabot.enabled job')
  return publisher.publishEvent('organization.integration.runnabot.enabled', data)
}

/**
 * Publish `github.bot.notify` command
 * @param {Object} data job payload
 */
module.exports.publishRunnabotDisabled = function (data) {
  log.info(data, 'publish organization.integration.runnabot.disabled job')
  return publisher.publishEvent('organization.integration.runnabot.disabled', data)
}
