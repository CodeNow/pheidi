'use strict'

require('loadenv')()

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')

const Slack = require('notifications/slack')
const tracker = require('models/tracker')

describe('Slack', function () {
  const ctx = {}
  ctx.instance = {
    _id: 'inst_1_id',
    name: 'server-1',
    owner: {
      github: 3213,
      username: 'CodeNow'
    }
  }

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
        const settings = {
          notifications: {
            slack: {
              enabled: true
            }
          }
        }
        const slack = new Slack(settings)
        assert.isFalse(slack._canSendMessage())
        done()
      })
    })

    it('should return true if notifications are enabled', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      const slack = new Slack(settings)
      assert.isTrue(slack._canSendMessage())
      done()
    })

    it('should return true if notifications are disabled', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false
          }
        }
      }
      const slack = new Slack(settings)
      assert.isFalse(slack._canSendMessage())
      done()
    })
  })
  describe('#sendDirectMessage', function () {
    beforeEach(function (done) {
      sinon.stub(tracker, 'get').returns(null)
      sinon.stub(tracker, 'set').returns(null)
      sinon.stub(tracker, 'del').returns(null)
      done()
    })

    afterEach(function (done) {
      tracker.get.restore()
      tracker.set.restore()
      tracker.del.restore()
      done()
    })

    it('should do nothing if user not found', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false
          }
        }
      }
      const slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage')
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, ctx.instance, function (err) {
        assert.isNull(err)
        sinon.assert.notCalled(slack.slackClient.sendPrivateMessage)
        done()
      })
    })

    it('should return err if slack client returned error', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      const slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(new Error('slack'))
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, ctx.instance, function (err) {
        assert.isDefined(err)
        assert.equal(err.message, 'slack')
        sinon.assert.calledOnce(slack.slackClient.sendPrivateMessage)
        sinon.assert.calledWith(slack.slackClient.sendPrivateMessage,
          123123, { text: 'hello' })
        done()
      })
    })

    it('should send private message if user found', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      const slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(null)
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, ctx.instance, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(slack.slackClient.sendPrivateMessage)
        sinon.assert.calledWith(slack.slackClient.sendPrivateMessage,
          123123, { text: 'hello' })
        done()
      })
    })

    it('should set cache but not delete on success', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      const slack = new Slack(settings)
      const message = { text: 'hello' }
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(null)
      slack.sendDirectMessage('podviaznikov', message, ctx.instance, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(tracker.set)
        sinon.assert.calledWith(tracker.set, 123123 + '/' + ctx.instance._id, message)
        sinon.assert.notCalled(tracker.del)
        done()
      })
    })

    it('should not send private message if cache found', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      const message = { text: 'hello' }
      const slack = new Slack(settings)
      tracker.get.returns(message)
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(null)
      slack.sendDirectMessage('podviaznikov', message, ctx.instance, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(tracker.get)
        sinon.assert.calledWith(tracker.get, 123123 + '/' + ctx.instance._id)
        sinon.assert.notCalled(slack.slackClient.sendPrivateMessage)
        done()
      })
    })

    it('should delete cache if slack client returned error', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false,
            githubUsernameToSlackIdMap: {
              'podviaznikov': 123123
            }
          }
        }
      }
      const slack = new Slack(settings)
      sinon.stub(slack.slackClient, 'sendPrivateMessage').yieldsAsync(new Error('slack'))
      slack.sendDirectMessage('podviaznikov', { text: 'hello' }, ctx.instance, function (err) {
        assert.isDefined(err)
        assert.equal(err.message, 'slack')
        sinon.assert.calledOnce(tracker.del)
        sinon.assert.calledWith(tracker.del, 123123 + '/' + ctx.instance._id )
        done()
      })
    })
  })

  describe('#notifyOnAutoDeploy', function () {
    it('should do nothing if slack messaging is disabled', function (done) {
      const slack = new Slack()
      slack.notifyOnAutoDeploy({}, 'anton', [], function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })

    it('should do nothing if slack messaging is disabled in settings', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: false
          }
        }
      }
      const slack = new Slack(settings)
      slack.notifyOnAutoDeploy({}, 'anton', [], function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })

    it('should do nothing if instance = null', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      const slack = new Slack(settings)
      slack.notifyOnAutoDeploy({}, 'anton', null, function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })

    it('should do nothing if user was not found', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      const slack = new Slack(settings)
      slack.notifyOnAutoDeploy({}, null, ctx.instance, function (err, resp) {
        assert.isNull(err)
        assert.isUndefined(resp)
        done()
      })
    })

    it('should send direct message', function (done) {
      const settings = {
        notifications: {
          slack: {
            enabled: true
          }
        }
      }
      const slack = new Slack(settings)
      const headCommit = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        message: 'init & commit & push long test \n next line \n 3d line',
        url: 'https://github.com/CodeNow/api/commit/a240edf982d467201845b3bf10ccbe16f6049ea9',
        committer: {
          username: 'podviaznikov'
        }
      }
      const commit2 = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        author: {
          username: 'podviaznikov'
        }
      }
      const gitInfo = {
        branch: 'feature-1',
        headCommit: headCommit,
        commitLog: [ headCommit, commit2 ],
        repo: 'CodeNow/api',
        repoName: 'api'
      }
      sinon.stub(slack, 'sendDirectMessage').yieldsAsync(null)
      slack.notifyOnAutoDeploy(gitInfo, 'podviaznikov', ctx.instance, function (err, resp) {
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
      const headCommit = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        message: 'init & commit & push long test \n next line \n 3d line',
        url: 'https://github.com/CodeNow/api/commit/a240edf982d467201845b3bf10ccbe16f6049ea9'
      }
      const commit2 = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        author: {
          username: 'podviaznikov'
        }
      }
      const gitInfo = {
        branch: 'feature-1',
        headCommit: headCommit,
        commitLog: [ headCommit, commit2 ],
        repo: 'CodeNow/api',
        repoName: 'api'
      }
      const text = Slack.createAutoDeployText(gitInfo, ctx.instance)
      var expected = 'Your <http://localhost:3031/actions/redirect?'
      expected += 'url=https%3A%2F%2Fgithub.com%2FCodeNow%2Fapi%2Fcommit%2Fa240edf982d467201845b3bf10ccbe16f6049ea9'
      expected += '|changes> (init &amp commit &amp push long test   next line   3d... and '
      expected += '<http://localhost:3031/actions/redirect?'
      expected += 'url=https%3A%2F%2Fgithub.com%2FCodeNow%2Fapi%2Fcompare%2Fa240edf982d4...a240edf982d4|1 more>)'
      expected += ' to CodeNow/api (feature-1) are deployed on'
      expected += ' <' + process.env.WEB_URL + '/CodeNow/server-1|server-1>'
      assert.equal(text, expected)
      done()
    })

    it('should return text if commitLog is []', function (done) {
      const headCommit = {
        id: 'a240edf982d467201845b3bf10ccbe16f6049ea9',
        message: 'init & commit & push long test \n next line \n 3d line',
        url: 'https://github.com/CodeNow/api/commit/a240edf982d467201845b3bf10ccbe16f6049ea9'
      }
      const gitInfo = {
        branch: 'feature-1',
        headCommit: headCommit,
        commitLog: [],
        repo: 'CodeNow/api',
        repoName: 'api'
      }
      const text = Slack.createAutoDeployText(gitInfo, ctx.instance)
      var expected = 'Your <http://localhost:3031/actions/redirect?'
      expected += 'url=https%3A%2F%2Fgithub.com%2FCodeNow%2Fapi%2Fcommit%2Fa240edf982d467201845b3bf10ccbe16f6049ea9'
      expected += '|changes> (init &amp commit &amp push long test   next line   3d...)'
      expected += ' to CodeNow/api (feature-1) are deployed on'
      expected += ' <' + process.env.WEB_URL + '/CodeNow/server-1|server-1>'
      assert.equal(text, expected)
      done()
    })
  })
})
