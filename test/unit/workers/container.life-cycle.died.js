/**
 * @module unit/workers/instance.deleted
 */
'use strict'

const chai = require('chai')
const Promise = require('bluebird')
const sinon = require('sinon')
const mongodbHelper = require('mongo-helper')
const TaskFatalError = require('ponos').TaskFatalError

require('sinon-as-promised')(Promise)
chai.use(require('chai-as-promised'))
const assert = chai.assert

const Worker = require('workers/container.life-cycle.died')

describe('Container life-cycle died Worker', () => {
  const testInstance = {
    _id: 'deadbeefdead',
    isTesting: true
  }
  const testParams = {
    id: 'fakeId',
    inspectData: {
      Config: {
        Labels: {
          type: 'image-builder-container',
          instanceId: testInstance._id
        }
      }
    }
  }
  let mongoHelperStubs
  beforeEach((done) => {
    mongoHelperStubs = {
      findOneInstanceAsync: sinon.stub().resolves(testInstance)
    }
    sinon.stub(mongodbHelper, 'helper').returns(mongoHelperStubs)
    done()
  })

  afterEach((done) => {
    mongodbHelper.helper.restore()
    done()
  })

  it('should fail if the instance is not for testing', (done) => {
    mongoHelperStubs.findOneInstanceAsync.resolves({
      _id: '1234',
      isTesting: false
    })
    Worker(testParams).asCallback(function (err) {
      assert.isDefined(err)
      assert.instanceOf(err, TaskFatalError)
      assert.match(err.message, /not for testing/i)
      assert.isFalse(err.data.report)
      done()
    })
  })
})
