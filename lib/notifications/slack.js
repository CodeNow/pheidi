/**
 * Slack API invokations for Runnable events
 * @module lib/notifications/slack
 */
'use strict'

const hash = require('object-hash')
const keypather = require('keypather')()
const last = require('101/last')
const lines = require('underscore.string/lines')
const prune = require('underscore.string/prune')

const SlackAPI = require('models/slack')
const tracker = require('models/tracker')
const monitor = require('monitor-dog')
const log = require('logger').child({ module: 'notifications/slack' })

// constant, key/val pair for query-string of generated links in slack
const REF_SLACK = 'ref=slack'

/**
 * settings should have `apiToken` property
 * @class
 */
class Slack {

  /**
   * @param {Object} settings
   * @param {Object} contextOwner
   */
  constructor (settings, contextOwner) {
    this.settings = settings
    this.contextOwner = contextOwner
    const apiToken = keypather.get(this.settings, 'notifications.slack.apiToken')
    this.slackClient = new SlackAPI(apiToken)
  }

  /**
   * Send direct slack message to the user using GitHub username.
   * if mapping is available.
   * @param  {String}   githubUsername GitHub username
   * @param  {Object}   message        slack message object
   * @param  {Function} cb
   */
  sendDirectMessage (githubUsername, message, cb) {
    log.trace({
      githubUsername: githubUsername,
      message: message
    }, 'sendDirectMessage')
    const mapping = keypather.get(this.settings,
        'notifications.slack.githubUsernameToSlackIdMap') || {}
    const slackId = mapping[githubUsername]
    if (!slackId) {
      return cb(null)
    }
    const messageId = hash({
      slackId: slackId,
      message: message
    })
    const tracked = tracker.get(messageId)
    if (tracked) {
      log.trace('we just send same message not long time ago')
      return cb(null)
    }
    this.slackClient.sendPrivateMessage(slackId, message, function (err, resp) {
      if (err) {
        return cb(err)
      }
      tracker.set(messageId, message)
      cb(err, resp)
    })
  }

  /**
   * Send Slack private message when git committer submission
   * was auto deployed to instances.
   * @param  {Object}   gitInfo infor about git push event
   * @param  {String}   github Username used for the slack id lookup
   * @param  {Object}   instance deployed instance objects
   * @param  {Function} cb
   */
  notifyOnAutoDeploy (gitInfo, githubUsername, instance, cb) {
    log.trace({
      gitInfo: gitInfo,
      instance: instance
    }, 'notifyOnAutoDeploy')
    if (!this._canSendMessage()) {
      return cb(null)
    }
    if (!instance) {
      return cb(null)
    }
    if (!githubUsername) {
      return cb(null)
    }
    gitInfo.headCommit = last(gitInfo.commitLog) || {}
    const text = Slack.createAutoDeployText(gitInfo, instance)
    const message = {
      text: text
    }
    this.sendDirectMessage(githubUsername, message, cb)
    const tags = [
      'env:' + process.env.NODE_ENV,
      'githubUsername:' + githubUsername
    ]
    monitor.increment('slack.deploy', 1, tags)
  }

  _canSendMessage () {
    const isEnabled = keypather.get(this.settings, 'notifications.slack.enabled')
    return (process.env.ENABLE_SLACK_MESSAGES === 'true') && isEnabled
  }
}

/**
 * Utility method to create text for the autodeploy event
 */
Slack.createAutoDeployText = function (gitInfo, instance) {
  const url = wrapGitHubLink(gitInfo.headCommit.url)
  var text = 'Your ' + createSlackLink(url, 'changes')
  text += ' (' + slackCommitMessage(gitInfo.headCommit.message)
  text += moreChangesSlack(gitInfo.repo, getCommits(gitInfo)) + ') to '
  text += gitInfo.repo + ' (' + gitInfo.branch + ')'
  text += ' are deployed on ' + createServerLink(instance)
  return text
}

module.exports = Slack

// Utility function to create slack formatted link
function createSlackLink (url, title) {
  return '<' + url + '|' + title + '>'
}

// Prepare array of commits based on github hook info
function getCommits (gitInfo) {
  const commits = gitInfo.commitLog || []
  if (commits.length === 0) {
    commits.push(gitInfo.headCommit)
  }
  return commits
}

/**
 * Produce a slack-formatted link & message
 * @param {Object} instance
 * @return {String}
 */
function createServerLink (instance) {
  const url = process.env.WEB_URL + '/' + instance.owner.username + '/' +
    instance.name + '?' + REF_SLACK
  return createSlackLink(url, instance.name)
}

function wrapGitHubLink (url) {
  return process.env.FULL_API_DOMAIN + '/actions/redirect?url=' + encodeURIComponent(url)
}

function slackCommitMessage (msg) {
  return slackEscape(commitMessageCleanup(msg))
}

/**
 * Format commit message to be shown in slack message. Convert multiline commit message to
 * one line, take first 50 characters and append `...` to the end.
 */
function commitMessageCleanup (message) {
  const withoutNewLines = lines(message).join(' ')
  return prune(withoutNewLines, 50).trim()
}

/**
 * Slack requires light escaping with just 3 rules:
 * & replaced with &amp
 * < replaced with &lt
 * > replaced with &gt
 */
const ampRegExp = new RegExp('&', 'g')
const ltRegExp = new RegExp('<', 'g')
const gtRegExp = new RegExp('>', 'g')
function slackEscape (str) {
  return str.replace(ampRegExp, '&amp').replace(ltRegExp, '&lt').replace(gtRegExp, '&gt')
}

function moreChangesSlack (repo, commitLog) {
  if (commitLog.length === 1) {
    return ''
  }
  var text = ' and <' + githubMoreLink(repo, commitLog)
  text += '|' + (commitLog.length - 1) + ' more>'
  return text
}

function githubMoreLink (repo, commitLog) {
  const fistCommitId = commitLog[0].id.slice(0, 12)
  const lastCommitId = last(commitLog).id.slice(0, 12)
  const targetUrl = 'https://github.com/' + repo +
    '/compare/' + fistCommitId + '...' + lastCommitId
  return wrapGitHubLink(targetUrl)
}
