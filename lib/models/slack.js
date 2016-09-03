/**
 * @module lib/models/slack
 */
'use strict'

const Warning = require('error-cat/errors/warning')
const SlackClient = require('slack-client')
const logger = require('logger').child({ module: 'slack' })

/**
 * Slack client
 * @class
 */
module.exports = class Slack {
  constructor (apiToken) {
    this.apiToken = apiToken
    this.slackClient = new SlackClient(apiToken, true, true)
  }

  /**
   * Send private message to the slack user.
   * @param  {String}   slackUserId slack user id
   * @param  {Object}   message     message object to be sent
   * @param  {Function} cb
   */
  sendPrivateMessage (slackUserId, message, cb) {
    const log = logger.child({
      slackUserId: slackUserId,
      message: message,
      method: 'sendPrivateMessage'
    })
    log.info('call')
    this.openPrivateChannel(slackUserId, (err, channelId) => {
      if (err || !channelId) {
        return cb(err)
      }
      this.sendChannelMessage(channelId, message, cb)
    })
  }

  /**
   * Send slack message over slack channel (can be public, private or im).
   * @param  {String}   channelId unique id of channel in slack
   * @param  {[type]}   message   message object to be sent
   * @param  {Function} cb
   */
  sendChannelMessage (channelId, message, cb) {
    const log = logger.child({
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
        const err = new Warning('Cannot send a slack message', {
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
   * @param  {Function} cb
   */
  openPrivateChannel (slackUserId, cb) {
    const log = logger.child({
      slackUserId: slackUserId,
      method: 'openPrivateChannel'
    })
    log.info('call')
    this.slackClient._apiCall('im.open', { user: slackUserId }, function (resp) {
      if (resp.error || !resp.channel) {
        const err = new Warning('Cannot open private channel', {
          err: resp.error,
          slackUserId: slackUserId
        })
        return cb(err)
      }
      const channelId = resp.channel.id
      cb(null, channelId)
    })
  }
}
