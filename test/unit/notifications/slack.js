'use strict'

require('loadenv')()

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')

const Slack = require('notifications/slack')

const path = require('path')
const moduleName = path.relative(process.cwd(), __filename)

describe('Slack: ' + moduleName, function () {
  before(function (done) {
    process.env.ENABLE_SLACK_MESSAGES = 'true'
    done()
  })
  after(function (done) {
    process.env.ENABLE_SLACK_MESSAGES = 'false'
    done()
  })
  describe('#_canSendMessage', function () {
    describe('with setting disabled locally', function () {
      before(function (done) {
        process.env.ENABLE_SLACK_MESSAGES = 'false'
        done()
      })
      after(function (done) {
        process.env.ENABLE_SLACK_MESSAGES = 'true'
        done()
      })
      it('should return false if notifications are enabled', function (done) {
        var settings = {
          notifications: {
            slack: {
              enabled: true
            }
          }
        }
        var slack = new Slack(settings)
        assert.isFalse(slack._canSendMessage())
        done()
      })
    })
    it('should return true if notifications are enabled', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      var slack = new Slack(settings)
      assert.isTrue(slack._canSendMessage())
      done()
    })
    it('should return true if notifications are disabled', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: false
          }
        }
      }
      var slack = new Slack(settings)
      assert.isFalse(slack._canSendMessage())
      done()
    })
  })
  describe('#sendDirectMessage', function () {
    it('should do nothing if user not found', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: false
          }
        }
      }
      var slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage')
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, function (err) {
        assert.isNull(err)
        sinon.assert.notCalled(slack.slackClient.sendPrivateMessage)
        done()
      })
    })
    it('should return err if slack client returned error', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      var slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(new Error('slack'))
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, function (err) {
        assert.isDefined(err)
        assert.equal(err.message, 'slack')
        sinon.assert.calledOnce(slack.slackClient.sendPrivateMessage)
        sinon.assert.calledWith(slack.slackClient.sendPrivateMessage,
          123123, { text: 'hello' })
        done()
      })
    })
    it('should send private message if user found', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      var slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(null)
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(slack.slackClient.sendPrivateMessage)
        sinon.assert.calledWith(slack.slackClient.sendPrivateMessage,
          123123, { text: 'hello' })
        done()
      })
    })
  })
  describe('#notifyOnAutoDeploy', function () {
    it('should do nothing if slack messaging is disabled', function (done) {
      var slack = new Slack()
      slack.notifyOnAutoDeploy({}, 'anton', [], function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })
    it('should do nothing if slack messaging is disabled in settings', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: false
          }
        }
      }
      var slack = new Slack(settings)
      slack.notifyOnAutoDeploy({}, 'anton', [], function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })
    it('should do nothing if instance = null', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      var slack = new Slack(settings)
      slack.notifyOnAutoDeploy({}, 'anton', null, function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })
    it('should do nothing if user was not found', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      var slack = new Slack(settings)
      var instance = {
        name: 'server-1',
        owner: {
          github: 3213,
          username: 'CodeNow'
        }
      }
      slack.notifyOnAutoDeploy({}, null, instance, function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })
    it('should send direct message', function (done) {
      var settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      var slack = new Slack(settings)
      var instance = {
        name: 'server-1',
        owner: {
          github: 3213,
          username: 'CodeNow'
        }
      }
      var headCommit = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        message: 'init & commit & push long test \n next line \n 3d line',
        url: 'https://github.com/CodeNow/api/commit/a240edf982d467201845b3bf10ccbe16f6049ea9',
        committer: {
          username: 'podviaznikov'
        }
      }
      var commit2 = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        author: {
          username: 'podviaznikov'
        }
      }
      var gitInfo = {
        branch: 'feature-1',
        headCommit: headCommit,
        commitLog: [ headCommit, commit2 ],
        repo: 'CodeNow/api',
        repoName: 'api'
      }
      sinon.stub(slack, 'sendDirectMessage').yieldsAsync(null)
      slack.notifyOnAutoDeploy(gitInfo, 'podviaznikov', instance, function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        sinon.assert.calledOnce(slack.sendDirectMessage)
        sinon.assert.calledWith(slack.sendDirectMessage,
          headCommit.committer.username)
        done()
      })
    })
  })

  describe('#_createAutoUpdateText', function () {
    it('should return text messages', function (done) {
      var headCommit = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        message: 'init & commit & push long test \n next line \n 3d line',
        url: 'https://github.com/CodeNow/api/commit/a240edf982d467201845b3bf10ccbe16f6049ea9'
      }
      var commit2 = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        author: {
          username: 'podviaznikov'
        }
      }
      var gitInfo = {
        branch: 'feature-1',
        headCommit: headCommit,
        commitLog: [ headCommit, commit2 ],
        repo: 'CodeNow/api',
        repoName: 'api'
      }
      var instance = {
        name: 'server-1',
        owner: {
          github: 3213,
          username: 'CodeNow'
        }
      }
      var domain = process.env.APP_SUBDOMAIN + '.' + process.env.DOMAIN
      var text = Slack.createAutoDeployText(gitInfo, instance)
      var expected = 'Your <http://localhost:3031/actions/redirect?'
      expected += 'url=https%3A%2F%2Fgithub.com%2FCodeNow%2Fapi%2Fcommit%2Fa240edf982d467201845b3bf10ccbe16f6049ea9'
      expected += '|changes> (init &amp commit &amp push long test   next line   3d... and '
      expected += '<http://localhost:3031/actions/redirect?'
      expected += 'url=https%3A%2F%2Fgithub.com%2FCodeNow%2Fapi%2Fcompare%2Fa240edf982d4...a240edf982d4|1 more>)'
      expected += ' to CodeNow/api (feature-1) are deployed on'
      expected += ' <https://' + domain + '/CodeNow/server-1?ref=slack|server-1>'
      assert.equal(text, expected)
      done()
    })

    it('should return text if commitLog is []', function (done) {
      var headCommit = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        message: 'init & commit & push long test \n next line \n 3d line',
        url: 'https://github.com/CodeNow/api/commit/a240edf982d467201845b3bf10ccbe16f6049ea9'
      }
      var gitInfo = {
        branch: 'feature-1',
        headCommit: headCommit,
        commitLog: [],
        repo: 'CodeNow/api',
        repoName: 'api'
      }
      var instance = {
        name: 'server-1',
        owner: {
          github: 3213,
          username: 'CodeNow'
        }
      }
      var domain = process.env.APP_SUBDOMAIN + '.' + process.env.DOMAIN
      var text = Slack.createAutoDeployText(gitInfo, instance)
      var expected = 'Your <http://localhost:3031/actions/redirect?'
      expected += 'url=https%3A%2F%2Fgithub.com%2FCodeNow%2Fapi%2Fcommit%2Fa240edf982d467201845b3bf10ccbe16f6049ea9'
      expected += '|changes> (init &amp commit &amp push long test   next line   3d...)'
      expected += ' to CodeNow/api (feature-1) are deployed on'
      expected += ' <https://' + domain + '/CodeNow/server-1?ref=slack|server-1>'
      assert.equal(text, expected)
      done()
    })
  })
})
