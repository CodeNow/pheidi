'use strict'

const isEmpty = require('101/is-empty')
const keypather = require('keypather')()
const runnableHostname = require('@runnable/hostname')

/**
 * Module that is responsible for rendering github bot messages
 * @class
 */
module.exports = class GitHubBotMessage {
  static render (gitInfo, instance, isolatedInstances) {
    const opts = {
      shortHash: instance.shortHash,
      instanceName: instance.name,
      branch: gitInfo.branch,
      ownerUsername: instance.owner.username,
      masterPod: instance.masterPod,
      userContentDomain: process.env.USER_CONTENT_DOMAIN
    }
    let message = ''

    message += 'Deployed '
    const statusIcon = GitHubBotMessage.renderStatusIcon(gitInfo.state)
    message += statusIcon + ' '
    const containerUrl = process.env.CONTAINER_URL_PROTOCOL + '://' + runnableHostname.direct(opts) + GitHubBotMessage.defaultPort(instance)
    message += GitHubBotMessage.createLink(instance.name, containerUrl)
    message += '. '
    const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' + instance.name
    message += GitHubBotMessage.createLink('View on Runnable', instanceUrl)
    message += '.'
    message += GitHubBotMessage.renderFooter(isolatedInstances)
    return message
  }

  static renderFooter (isolatedInstances) {
    let isolatedLinks = GitHubBotMessage.renderIsolatedInstance(isolatedInstances)
    const endMessage = 'From ' + this.createLink('Runnable', 'http://runnable.com') + '*</sub>'
    if (isolatedLinks.length === 0) {
      return '\n<sub>*' + endMessage
    }
    return '\n' + isolatedLinks + '*— ' + endMessage
  }

  static renderIsolatedInstance (isolatedInstances) {
    let message = ''
    if (isolatedInstances && !isEmpty(isolatedInstances)) {
      message += '<sub>Related containers: '
      const linksList = isolatedInstances.map((instance) => {
        const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' +
            instance.name
        const readableInstanceName = GitHubBotMessage.cleanupInstanceName(instance.name)
        const link = GitHubBotMessage.createLink(readableInstanceName, instanceUrl)
        return link
      })
      message += linksList.join(', ')
    }
    return message
  }

  static renderStatusIcon (state) {
    if (state === 'running') {
      return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9">'
    }
    if (state === 'stopped') {
      return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-gray.svg" title="Stopped" width="9" height="9">'
    }
    if (state === 'building') {
      return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-orange.svg" title="Building" width="9" height="9">'
    }
    return '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9">'
  }

  static defaultPort (instance) {
    const ports = GitHubBotMessage.instancePorts(instance)
    if (ports.length > 0) {
      if (ports.indexOf('80') === -1) {
        return ':' + ports[0]
      }
    }
    return ''
  }

  static instancePorts (instance) {
    const portsObj = keypather.get(instance, 'containers[0].ports')
    if (!portsObj) {
      return []
    }
    return Object.keys(portsObj).map((port) => {
      return port.split('/')[0]
    })
  }

  static cleanupInstanceName (instanceName) {
    // if fullname prefixed by shortHash and -- we need to cleaned it up
    // drop only first `--`
    const fullName = instanceName
    const splitByPrefix = fullName.split('--')
    let shortName = splitByPrefix[0]
    if (splitByPrefix.length > 1) {
      splitByPrefix.shift()
      shortName = splitByPrefix.join('--')
    }
    return shortName
  }
  /**
   * Produce a markdown-formatted link
   * @param {String} link title
   * @param {String} link url
   * @return {String}
   */
  static createLink (title, url) {
    return '[' + title + '](' + url + ')'
  }
}
