'use strict'

const keypather = require('keypather')()

/**
 * Find instance state based on the instance CV and attached container
 * @param {Object} instance to find correct state
 * @return {String} state of the instance: failed, stopped, running, building or null
 */
module.exports.instanceState = (instance) => {
  const container = keypather.get(instance, 'containers[0]') || {}
  const cv = keypather.get(instance, 'contextVersions[0]') || {}
  const build = cv.build || {}
  if (build.failed) {
    return 'failed'
  }
  if (build.completed) {
    const continerStatus = keypather.get(container, 'inspect.State.Status')
    if (container && continerStatus === 'exited') {
      return 'stopped'
    }
    return 'running'
  }
  if (cv.state === 'build_started') {
    return 'building'
  }
  return null
}
