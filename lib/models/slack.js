/**
 * @module lib/models/slack
 */
'use strict'

const Warning = require('error-cat/errors/warning')
const SlackClient = require('slack-client')
const logger = require('../logger')

module.exports = Slack

function Slack (apiToken) {
  this.apiToken = apiToken
  this.slackClient = new SlackClient(apiToken, true, true)
}

/**
 * Send private message to the slack user.
 * @param  {String}   slackUserId slack user id
 * @param  {Object}   message     message object to be sent
 * @param  {Function} cb
 */
Slack.prototype.sendPrivateMessage = function (slackUserId, message, cb) {
  var log = logger.child({
    tx: true,
    slackUserId: slackUserId,
    message: message,
    method: 'sendPrivateMessage'
  })
  log.info('call')
  this.openPrivateChannel(slackUserId, function (err, channelId) {
    if (err || !channelId) {
      return cb(err)
    }
    this.sendChannelMessage(channelId, message, cb)
  }.bind(this))
}

/**
 * Send slack message over slack channel (can be public, private or im).
 * @param  {String}   channelId unique id of channel in slack
 * @param  {[type]}   message   message object to be sent
 * @param  {Function} cb        [description]
 */
Slack.prototype.sendChannelMessage = function (channelId, message, cb) {
  var log = logger.child({
    tx: true,
    channelId: channelId,
    message: message,
    method: 'sendChannelMessage'
  })
  log.info('call')
  message.channel = channelId
  message.username = process.env.SLACK_BOT_USERNAME
  message.icon_url = process.env.SLACK_BOT_IMAGE
  this.slackClient._apiCall('chat.postMessage', message, function (resp) {
    if (resp.error) {
      var err = new Warning('Cannot send a slack message', {
        err: resp.error,
        data: {
          channelId: channelId,
          message: message
        }
      })
      return cb(err)
    }
    cb(null, resp)
  })
}

/**
 * Open new slack channel between bot and slack user.
 * @param  {[type]}   slackUserId slack user id
 * @param  {Function} cb          [description]
 */
Slack.prototype.openPrivateChannel = function (slackUserId, cb) {
  var log = logger.child({
    tx: true,
    slackUserId: slackUserId,
    method: 'openPrivateChannel'
  })
  log.info('call')
  this.slackClient._apiCall('im.open', {user: slackUserId}, function (resp) {
    if (resp.error || !resp.channel) {
      var err = new Warning('Cannot open private channel', {
        err: resp.error,
        slackUserId: slackUserId
      })
      return cb(err)
    }
    var channelId = resp.channel.id
    cb(null, channelId)
  })
}
