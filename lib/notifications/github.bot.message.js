'use strict'

const find = require('101/find')
const isEmpty = require('101/is-empty')
const keypather = require('keypather')()
const runnableHostname = require('@runnable/hostname')
const logger = require('logger').child({ module: 'notifications/github-bot-message' })

/**
 * Module that is responsible for rendering github bot messages
 * @class
 */
module.exports = class GitHubBotMessage {
  static render (gitInfo, instance, isolatedInstances) {
    const log = logger.child({
      gitInfo: gitInfo,
      instance: instance,
      isolatedInstances: isolatedInstances,
      method: 'render'
    })
    log.info('call')
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
    if (isolatedInstances && instance.inputClusterConfig) {
      return GitHubBotMessage.renderClusterMessage(instance, isolatedInstances, opts, message) + '.' + GitHubBotMessage.renderFooter(instance)
    }

    const instanceRepo = gitInfo.repo.split('/')[1]
    const containerUrl = GitHubBotMessage.getContainerUrl(opts, instance)
    message += GitHubBotMessage.createLink(instanceRepo, containerUrl) + '.' + GitHubBotMessage.renderFooter(instance)
    return message
  }

  static renderClusterMessage (instance, isolatedInstances, opts, message) {
    let clusterPrefix = instance.inputClusterConfig.clusterName + '-'
    let clusterInstanceName = instance.name.split(clusterPrefix)[1]
    let containerUrl = GitHubBotMessage.getContainerUrl(opts, instance)
    
    message += GitHubBotMessage.createLink(clusterInstanceName, containerUrl)
    opts.shortHash = ''
    opts.isolated = true
    
    message += isolatedInstances.reduce((msg, instance) => {
      opts.instanceName = instance.name
      clusterInstanceName = instance.name.split(clusterPrefix)[1]
      containerUrl = GitHubBotMessage.getContainerUrl(opts, instance)
      return msg + ', ' + GitHubBotMessage.renderStatusIcon(keypather.get(instance, 'container.inspect.State.Status')) + ' ' +
             GitHubBotMessage.createLink(clusterInstanceName, containerUrl)
    }, '')
    return message
  }

  static getContainerUrl (opts, instance) {
    console.log(opts, instance)
    return process.env.CONTAINER_URL_PROTOCOL + '://' + runnableHostname.direct(opts) + GitHubBotMessage.defaultPort(instance)
  }

  static renderFooter (instance) {
    const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' + instance.name
    var message = '\n<sub>*' + GitHubBotMessage.createLink('View on Runnable', instanceUrl) + '*</sub>'
    return message
  }

  static renderIsolatedInstance (isolatedInstances) {
    let message = ''
    if (isolatedInstances && !isEmpty(isolatedInstances)) {
      message += '<sub>Related containers: '
      const linksList = isolatedInstances.map((instance) => {
        const instanceUrl = process.env.WEB_URL + '/' + instance.owner.username + '/' +
            instance.name
        const readableInstanceName = GitHubBotMessage.formatInstanceName(instance)
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

  static getMainAppCodeVersion (appCodeVersions) {
    if (!appCodeVersions) { return null }
    return find(appCodeVersions, function (appCodeVersion) {
      return !appCodeVersion.additionalRepo
    })
  }

  static getBranchName (instance) {
    const acvs = keypather.get(instance, 'contextVersions[0].appCodeVersions')
    if (acvs) {
      const acv = GitHubBotMessage.getMainAppCodeVersion(acvs)
      if (acv) {
        return acv.branch
      }
    }
    return null
  }

  static formatInstanceName (instance) {
    const instanceName = GitHubBotMessage.cleanupInstanceName(instance.name)
    const branchName = GitHubBotMessage.getBranchName(instance)
    if (!branchName) {
      return instanceName
    }
    // +1 to include dash
    const masterInstanceName = instanceName.substring(branchName.length + 1)
    return masterInstanceName + '/' + branchName
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
