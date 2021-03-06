'use strict'

require('loadenv')()

const joi = require('joi')
const RabbitMQ = require('ponos/lib/rabbitmq')
const schemas = require('models/schemas')

const prBotEnabledSchema = joi.object({
  organization: joi.object({
    id: joi.number().required()
  }).required()
}).required()

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
    jobSchema: schemas.githubBotNotify
  }],
  events: [{
    name: 'organization.integration.prbot.enabled',
    jobSchema: prBotEnabledSchema
  }]
})

module.exports.publisher = publisher

/**
 * Publish `github.bot.notify` command
 * @param {Object} data job payload
 */
module.exports.publishGitHubBotNotify = function (data) {
  return publisher.publishTask('github.bot.notify', data)
}
/**
 * Publish `organization.integration.prbot.enabled` command
 *
 * @param {Object} data                 - job payload
 * @param {Object} data.organization.id - BigPoppa Org Id to add the PRbot
 */
module.exports.publishPrBotEnabled = function (data) {
  return publisher.publishEvent('organization.integration.prbot.enabled', data)
}
