'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert

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
})
