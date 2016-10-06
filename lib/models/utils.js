'use strict'

const keypather = require('keypather')()

/**
 * Find instance state based on the instance CV and attached container
 * @param {Object} instance to find correct state
 * @return {String} state of the instance: failed, stopped, running, building or null
 */
exports.instanceState = (instance) => {
  const container = keypather.get(instance, 'containers[0]') ||
    keypather.get(instance, 'container') || {}
  const cv = keypather.get(instance, 'contextVersions[0]') ||
    keypather.get(instance, 'contextVersion') || {}
  const build = cv.build || {}
  if (build.failed) {
    return 'failed'
  }
  if (build.completed) {
    const containerStatus = keypather.get(container, 'inspect.State.Status')
    if (containerStatus === 'exited' || containerStatus === 'error') {
      return 'stopped'
    }
    if (containerStatus === 'running') {
      return 'running'
    }
  }
  if (cv.state === 'build_started') {
    return 'building'
  }
  return null
}

/**
 * Checks if pheidi should ignore given job
 * @param {Object} job
 * @return {Boolean} true if job should be ignored
 */
exports.ignoreContainerLifeCycleJob = (job) => {
  if (!job.inspectData) {
    return true
  }
  const type = keypather.get(job, 'inspectData.Config.Labels.type')
  if (type !== 'user-container' && type !== 'image-builder-container') {
    return true
  }
}
