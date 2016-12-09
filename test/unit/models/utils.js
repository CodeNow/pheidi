'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
require('sinon-as-promised')(Promise)

const utils = require('models/utils')

describe('Utils', function () {
  describe('#instanceState', function () {
    it('should return failed if build failed', function (done) {
      const cv = {
        build: {
          failed: true
        }
      }
      const state = utils.instanceState({
        contextVersions: [ cv ],
        containers: [{}]
      })
      assert.equal(state, 'failed')
      done()
    })

    it('should return running if build completed and container running', function (done) {
      const cv = {
        build: {
          failed: false,
          completed: new Date().getTime()
        }
      }
      const container = {
        inspect: {
          State: {
            Status: 'running'
          }
        }
      }
      const state = utils.instanceState({
        contextVersions: [ cv ],
        containers: [ container ]
      })
      assert.equal(state, 'running')
      done()
    })

    it('should return stopped if build completed but container exited', function (done) {
      const cv = {
        build: {
          failed: false,
          completed: new Date().getTime()
        }
      }
      const container = {
        inspect: {
          State: {
            Status: 'exited'
          }
        }
      }
      const state = utils.instanceState({
        contextVersions: [ cv ],
        containers: [ container ]
      })
      assert.equal(state, 'stopped')
      done()
    })

    it('should return stopped if build completed but container errored', function (done) {
      const cv = {
        build: {
          failed: false,
          completed: new Date().getTime()
        }
      }
      const container = {
        inspect: {
          State: {
            Status: 'exited'
          }
        }
      }
      const state = utils.instanceState({
        contextVersions: [ cv ],
        containers: [ container ]
      })
      assert.equal(state, 'stopped')
      done()
    })

    it('should return build_started if build has that status', function (done) {
      const cv = {
        state: 'build_started',
        build: {}
      }
      const container = {}
      const state = utils.instanceState({
        contextVersions: [ cv ],
        containers: [ container ]
      })
      assert.equal(state, 'building')
      done()
    })

    it('should return null if status cannot be calculated', function (done) {
      const cv = {
        state: 'build_not_started',
        build: {}
      }
      const container = {}
      const state = utils.instanceState({
        contextVersions: [ cv ],
        containers: [ container ]
      })
      assert.isNull(state)
      done()
    })
  })

  describe('#getPushInfoForInstance', () => {
    let instance
    const repo = 'CodeNow/api'
    const branch = 'feature1'

    beforeEach(() => {
      instance = {
        owner: {
          github: 2828361,
          username: 'Runnable'
        },
        contextVersion: {
          appCodeVersions: [{
            repo,
            branch
          }],
          build: {
            failed: true
          }
        }
      }
      sinon.stub(utils, 'instanceState').returns('failed')
    })
    afterEach(() => {
      utils.instanceState.restore()
    })

    it('should return the push info if all conditions have been met', function (done) {
      const pushInfo = utils.getPushInfoForInstance(instance)
      assert.deepEqual(pushInfo, {
        repo,
        branch,
        state: 'failed'
      })
      done()
    })

    it('should do nothing if testing instance', function (done) {
      instance.isTesting = true
      const pushInfo = utils.getPushInfoForInstance(instance)
      assert.isNull(pushInfo)
      done()
    })

    it('should do nothing if no acv was found', function (done) {
      instance.contextVersion.appCodeVersions[0].additionalRepo = true
      const pushInfo = utils.getPushInfoForInstance(instance)
      assert.isNull(pushInfo)
      done()
    })

    it('should do nothing if instance state is invalid', function (done) {
      utils.instanceState.returns(null)
      const pushInfo = utils.getPushInfoForInstance(instance)
      assert.isNull(pushInfo)
      done()
    })
  })
})
