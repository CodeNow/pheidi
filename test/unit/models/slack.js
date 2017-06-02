/**
 * @module unit/models/slack
 */
'use strict'
require('loadenv')()

var sinon = require('sinon')
const chai = require('chai')
const assert = chai.assert
chai.use(require('chai-as-promised'))

const SlackModel = require('models/slack')

describe('slack', () => {
  let slack

  describe('Methods', () => {
    let slackUserId
    let channelId
    let message

    beforeEach((done) => {
      slack = new SlackModel('ABCD')
      done()
    })

    afterEach((done) => {
      done()
    })

    describe('#sendPrivateMessage', () => {
      let sendChannelMessageStub
      let openPrivateChannelStub

      beforeEach((done) => {
        sendChannelMessageStub = sinon.stub(slack, 'sendChannelMessage')
        openPrivateChannelStub = sinon.stub(slack, 'openPrivateChannel')
        done()
      })

      afterEach((done) => {
        sendChannelMessageStub.restore()
        openPrivateChannelStub.restore()
        done()
      })

      it('should return an error if openPrivateChannel returns an error', (done) => {
        let thrownErr = new Error('Cannot open private channel')
        openPrivateChannelStub.yieldsAsync(thrownErr, '')
        slackUserId = 'ABCD'
        message = 'Hey there!'
        slack.sendPrivateMessage(slackUserId, message, (err) => {
          assert.isDefined(err)
          assert.equal(err, thrownErr)
          sinon.assert.calledOnce(slack.openPrivateChannel)
          done()
        })
      })

      it('should return an error if there is no channelId', (done) => {
        openPrivateChannelStub.yieldsAsync({})
        slackUserId = 'ABCD'
        message = 'Hey there!'
        slack.sendPrivateMessage(slackUserId, message, (err) => {
          assert.isDefined(err)
          sinon.assert.calledOnce(slack.openPrivateChannel)
          done()
        })
      })
    })

    describe('#sendChannelMessage', () => {
      let slackAPICallStub

      beforeEach((done) => {
        slackAPICallStub = sinon.stub(slack.slackClient, '_apiCall')
        done()
      })

      afterEach((done) => {
        slackAPICallStub.restore()
        done()
      })

      it('should respond with success message if Slack API call worked', (done) => {
        channelId = '1234'
        message = 'Worked'
        slackAPICallStub.yieldsAsync({ message, error: null })
        slack.sendChannelMessage(channelId, (response) => {
          assert.isNull(response.error)
          assert.equal(response.message, message)
          sinon.assert.calledOnce(slack.slackClient._apiCall)
          done()
        })
      })
    })

    describe('#openPrivateChannel', () => {
      let slackAPICallStub

      beforeEach((done) => {
        slackAPICallStub = sinon.stub(slack.slackClient, '_apiCall')
        done()
      })

      afterEach((done) => {
        slackAPICallStub.restore()
        done()
      })

      it('should respond with success message if Slack API call worked', (done) => {
        slackUserId = 'ABCD'
        channelId = '1234'
        message = 'Worked'
        slackAPICallStub.yieldsAsync({ message, channel: { id: channelId }, error: null })
        slack.openPrivateChannel(slackUserId, (err, response) => {
          assert.isNull(err)
          assert.equal(response, channelId)
          sinon.assert.calledOnce(slack.slackClient._apiCall)
          done()
        })
      })
    })
  })
})
