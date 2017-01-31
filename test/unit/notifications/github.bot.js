'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const bigPoppa = require('models/big-poppa')
const clone = require('101/clone')
const sinon = require('sinon')
const Promise = require('bluebird')
require('sinon-as-promised')(Promise)
const rabbitmq = require('rabbitmq')
const GitHubBot = require('notifications/github.bot')
const GitHub = require('models/github')
const tracker = require('models/tracker')

describe('GitHubBot', function () {
  const ctx = {}
  beforeEach(function (done) {
    ctx.instance = {
      _id: 'inst-1-id',
      name: 'inst-1',
      owner: {
        username: 'codenow'
      },
      shortHash: 'ga71a12',
      masterPod: true,
      container: {}
    }
    done()
  })

  describe('#getToken', function () {
    beforeEach(function (done) {
      ctx.originalGitHubTokens = process.env.RUNNABOT_GITHUB_ACCESS_TOKENS
      done()
    })
    afterEach(function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = ctx.originalGitHubTokens
      done()
    })

    it('should throw if access tokens are not defined', function (done) {
      delete process.env.RUNNABOT_GITHUB_ACCESS_TOKENS
      assert.throws(GitHubBot.getToken, 'Configuration error: runnabot gh access token is not defined')
      done()
    })

    it('should throw if access tokens is not string', function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = 1
      assert.throws(GitHubBot.getToken, 'Configuration error: runnabot gh access token is not defined')
      done()
    })

    it('should return empty token if tokens are empty', function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = ''
      assert.equal(GitHubBot.getToken(), '')
      done()
    })

    it('should return 1 element if one token defined', function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = 'token1'
      assert.equal(GitHubBot.getToken(), 'token1')
      done()
    })

    it('should return 1 element if one token defined', function (done) {
      const tokens = [
        'token1',
        'token2',
        'token3',
        'token4'
      ]
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = tokens.join(',')
      assert.include(tokens, GitHubBot.getToken())
      done()
    })
  })

  describe('#_deleteComments', function () {
    beforeEach(function (done) {
      ctx.comments = [
        {
          body: 'PR-2 is deployed',
          id: 2
        },
        {
          body: 'PR-1 is deployed',
          id: 1
        }
      ]
      sinon.stub(GitHub.prototype, 'findCommentsByUser').yieldsAsync(null, ctx.comments)
      sinon.stub(GitHub.prototype, 'deleteComment').yieldsAsync(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.findCommentsByUser.restore()
      GitHub.prototype.deleteComment.restore()
      done()
    })

    it('should fail if findCommentsByUser failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.findCommentsByUser.yieldsAsync(githubError)
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo, function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should fail if delete comment failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.deleteComment.yieldsAsync(githubError)
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo, function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should call functions in order and not fail', function (done) {
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo, function (error) {
        assert.isNull(error)
        sinon.assert.callOrder(GitHub.prototype.findCommentsByUser, GitHub.prototype.deleteComment)
        done()
      })
    })

    it('should call findCommentsByUser with correct params', function (done) {
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo, function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUser, gitInfo.repo, gitInfo.number)
        done()
      })
    })

    it('should call deletComment twice', function (done) {
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo, function (error) {
        assert.isNull(error)
        sinon.assert.calledTwice(GitHub.prototype.deleteComment)
        sinon.assert.calledWith(GitHub.prototype.deleteComment, gitInfo.repo, ctx.comments[0].id)
        sinon.assert.calledWith(GitHub.prototype.deleteComment, gitInfo.repo, ctx.comments[1].id)
        done()
      })
    })
  })
  describe('#_upsertComment', function () {
    beforeEach(function (done) {
      ctx.comment = {
        body: 'PR-2 is deployed to ' + ctx.instance.name,
        id: 2
      }
      sinon.stub(GitHub.prototype, 'findCommentsByUser').yieldsAsync(null, [ctx.comment])
      sinon.stub(GitHub.prototype, 'addComment').yieldsAsync(null)
      sinon.stub(GitHub.prototype, 'updateComment').yieldsAsync(null)
      sinon.stub(tracker, 'get').returns(null)
      sinon.stub(tracker, 'set').returns(null)
      sinon.stub(tracker, 'del').returns(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.findCommentsByUser.restore()
      GitHub.prototype.addComment.restore()
      GitHub.prototype.updateComment.restore()
      tracker.get.restore()
      tracker.set.restore()
      tracker.del.restore()
      done()
    })

    it('should fail if findCommentsByUser failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.findCommentsByUser.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should fail if updateComment failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.updateComment.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should fail if addComment failed', function (done) {
      GitHub.prototype.findCommentsByUser.yieldsAsync(null, null)
      const githubError = new Error('GitHub error')
      GitHub.prototype.addComment.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should fail if container not found on instance', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      delete ctx.instance.container
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isDefined(error)
        assert.match(error.message, /The instance is missing the container/)
        done()
      })
    })

    it('should succeed if container is found on instance.containers', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      ctx.instance.containers = [ctx.instance.container]
      delete ctx.instance.container
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        done()
      })
    })

    it('should succeed if container is missing but is building', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'building'
      }
      delete ctx.instance.container
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        done()
      })
    })

    it('should call updateComment if comment found', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      let message = 'Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com)'
      message += '. [View on Runnable](https://web.runnable.dev/codenow/inst-1).'
      message += '\n<sub>*From [Runnable](http://runnable.com)*</sub>'
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledWith(tracker.set, 'codenow/hellonode/2/inst-1-id', message)
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUser,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME,
          sinon.match.func)
        sinon.assert.calledOnce(GitHub.prototype.updateComment)
        sinon.assert.calledWith(GitHub.prototype.updateComment,
          gitInfo.repo,
          ctx.comment.id,
          message,
          sinon.match.func)
        done()
      })
    })

    it('should call createComment if comment not found', function (done) {
      GitHub.prototype.findCommentsByUser.yieldsAsync(null, null)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      let message = 'Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com)'
      message += '. [View on Runnable](https://web.runnable.dev/codenow/inst-1).'
      message += '\n<sub>*From [Runnable](http://runnable.com)*</sub>'
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(tracker.set)
        sinon.assert.calledWith(tracker.set, 'codenow/hellonode/2/inst-1-id', message)
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUser,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME,
          sinon.match.func)
        sinon.assert.calledOnce(GitHub.prototype.addComment)
        sinon.assert.calledWith(GitHub.prototype.addComment,
          gitInfo.repo,
          gitInfo.number,
          message,
          sinon.match.func
        )
        done()
      })
    })

    it('should delete cache if updateComment failed', function (done) {
      const githubBot = new GitHubBot('anton-token')
      GitHub.prototype.updateComment.yieldsAsync(new Error('GitHub error'))
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.equal(error.message, 'GitHub error')
        sinon.assert.calledOnce(tracker.del)
        sinon.assert.calledWith(tracker.del, 'codenow/hellonode/2/inst-1-id')
        done()
      })
    })

    it('should delete cache if create comment failed', function (done) {
      GitHub.prototype.findCommentsByUser.yieldsAsync(null, null)
      GitHub.prototype.addComment.yieldsAsync(new Error('GitHub error'))
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.equal(error.message, 'GitHub error')
        sinon.assert.calledOnce(tracker.del)
        sinon.assert.calledWith(tracker.del, 'codenow/hellonode/2/inst-1-id')
        done()
      })
    })

    it('should not do create comment if cache found', function (done) {
      const message = 'Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com). [View on Runnable](https://web.runnable.dev/codenow/inst-1).\n<sub>*From [Runnable](http://runnable.com)*</sub>'
      tracker.get.returns(message)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(tracker.get)
        sinon.assert.calledWith(tracker.get, 'codenow/hellonode/2/inst-1-id')
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUser,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME,
          sinon.match.func)
        sinon.assert.notCalled(GitHub.prototype.updateComment)
        done()
      })
    })

    it('should not update comment if comment did not change', function (done) {
      GitHub.prototype.findCommentsByUser.yieldsAsync(null, [{
        body: 'Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com). [View on Runnable](https://web.runnable.dev/codenow/inst-1).\n<sub>*From [Runnable](http://runnable.com)*</sub>',
        id: 2
      }])
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUser,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME,
          sinon.match.func)
        sinon.assert.notCalled(GitHub.prototype.updateComment)
        done()
      })
    })
  })
  describe('#_upsertComments', function () {
    beforeEach(function (done) {
      sinon.stub(GitHub.prototype, 'listOpenPullRequestsForBranch').yieldsAsync(null, [
        {
          number: 1
        },
        {
          number: 2
        }
      ])
      sinon.stub(GitHubBot.prototype, '_upsertComment').yieldsAsync(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.listOpenPullRequestsForBranch.restore()
      GitHubBot.prototype._upsertComment.restore()
      done()
    })

    it('should fail if fetching prs failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.listOpenPullRequestsForBranch.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComments(gitInfo, ctx.instance, [], function (err) {
        assert.isDefined(err)
        assert.equal(err, githubError)
        done()
      })
    })

    it('should fail if upserting comment failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHubBot.prototype._upsertComment.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComments(gitInfo, ctx.instance, [], function (err) {
        assert.isDefined(err)
        assert.equal(err, githubError)
        done()
      })
    })

    it('should upsert 2 comments to two prs', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComments(gitInfo, ctx.instance, [], function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.listOpenPullRequestsForBranch)
        sinon.assert.calledWith(GitHub.prototype.listOpenPullRequestsForBranch,
          gitInfo.repo,
          gitInfo.branch,
          sinon.match.func)
        sinon.assert.calledTwice(GitHubBot.prototype._upsertComment)
        const pushInfo1 = clone(gitInfo)
        pushInfo1.number = 1
        const pushInfo2 = clone(gitInfo)
        pushInfo2.number = 2
        sinon.assert.calledWith(GitHubBot.prototype._upsertComment,
          pushInfo1, ctx.instance, [], sinon.match.func)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComment,
          pushInfo2, ctx.instance, [], sinon.match.func)
        done()
      })
    })
  })

  describe('#checkPrBotEnabledAndAcceptInvite', function () {
    let org
    beforeEach(function (done) {
      org = {
        id: 23,
        name: 'Hello',
        lowerName: 'hello',
        prBotEnabled: false
      }
      sinon.stub(GitHub.prototype, 'acceptInvitationAsync').resolves(null)
      sinon.stub(bigPoppa, 'getOrganizations').resolves([org])
      sinon.stub(rabbitmq, 'publishPrBotEnabled').resolves()
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.acceptInvitationAsync.restore()
      bigPoppa.getOrganizations.restore()
      rabbitmq.publishPrBotEnabled.restore()
      done()
    })

    it('should fail if accept invitation failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.acceptInvitationAsync.rejects(githubError)
      const githubBot = new GitHubBot('anton-token')
      githubBot.checkPrBotEnabledAndAcceptInvite(org.name)
        .asCallback((err) => {
          assert.isDefined(err)
          assert.equal(err, githubError)
          done()
        })
    })
    it('should fail if getOrganizations failed', function (done) {
      const bigPoppaError = new Error('BigPoppa error')
      bigPoppa.getOrganizations.rejects(bigPoppaError)
      const githubBot = new GitHubBot('anton-token')
      githubBot.checkPrBotEnabledAndAcceptInvite(org.name)
        .asCallback((err) => {
          assert.isDefined(err)
          assert.equal(err, bigPoppaError)
          done()
        })
    })

    it('should skip checking github if prBotEnabled returns true', function (done) {
      org.prBotEnabled = true
      const githubBot = new GitHubBot('anton-token')
      githubBot.checkPrBotEnabledAndAcceptInvite(org.name)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.notCalled(GitHub.prototype.acceptInvitationAsync)
          sinon.assert.notCalled(rabbitmq.publishPrBotEnabled)
          done()
        })
    })

    it('should check github, then create the job if prBotEnabled is false', function (done) {
      const githubBot = new GitHubBot('anton-token')
      githubBot.checkPrBotEnabledAndAcceptInvite(org.name)
        .asCallback((err) => {
          assert.isNull(err)
          sinon.assert.calledOnce(GitHub.prototype.acceptInvitationAsync)
          sinon.assert.calledWith(GitHub.prototype.acceptInvitationAsync, org.name)
          sinon.assert.calledOnce(rabbitmq.publishPrBotEnabled)
          sinon.assert.calledWith(rabbitmq.publishPrBotEnabled, { organization: { id: org.id } })
          done()
        })
    })
  })
  describe('#notifyOnUpdate', function () {
    beforeEach(function (done) {
      sinon.stub(GitHubBot.prototype, '_upsertComments').yieldsAsync(null)
      sinon.stub(GitHubBot.prototype, 'checkPrBotEnabledAndAcceptInvite').resolves()
      done()
    })

    afterEach(function (done) {
      GitHubBot.prototype._upsertComments.restore()
      GitHubBot.prototype.checkPrBotEnabledAndAcceptInvite.restore()
      done()
    })

    describe('bot disabled', function () {
      before(function (done) {
        process.env.ENABLE_GITHUB_PR_COMMENTS = 'false'
        done()
      })
      after(function (done) {
        process.env.ENABLE_GITHUB_PR_COMMENTS = 'true'
        done()
      })

      it('should do nothing', function (done) {
        const githubBot = new GitHubBot('anton-token')
        const gitInfo = {
          repo: 'codenow/hellonode',
          branch: 'feature-1',
          number: 2,
          state: 'running'
        }
        githubBot.notifyOnUpdate(gitInfo, ctx.instance, [], function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHubBot.prototype.checkPrBotEnabledAndAcceptInvite)
          sinon.assert.notCalled(GitHubBot.prototype._upsertComments)
          done()
        })
      })
    })

    it('should fail if upserting comments failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHubBot.prototype._upsertComments.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot.notifyOnUpdate(gitInfo, ctx.instance, [], function (err) {
        assert.isDefined(err)
        assert.equal(err.cause, githubError)
        done()
      })
    })

    it('should work without errors', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot.notifyOnUpdate(gitInfo, ctx.instance, [], function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHubBot.prototype.checkPrBotEnabledAndAcceptInvite)
        sinon.assert.calledWith(GitHubBot.prototype.checkPrBotEnabledAndAcceptInvite,
          ctx.instance.owner.username)
        sinon.assert.calledOnce(GitHubBot.prototype._upsertComments)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComments,
          gitInfo, ctx.instance, [], sinon.match.func)
        done()
      })
    })
  })

  describe('#deleteAllNotifications', function () {
    beforeEach(function (done) {
      ctx.prs = [
        { number: 1 },
        { number: 2 }
      ]
      sinon.stub(GitHub.prototype, 'listOpenPullRequests').yieldsAsync(null, ctx.prs)
      sinon.stub(GitHubBot.prototype, '_deleteComments').yieldsAsync(null)
      done()
    })

    afterEach(function (done) {
      ctx.prs = [
        { number: 1 },
        { number: 2 }
      ]
      GitHub.prototype.listOpenPullRequests.restore()
      GitHubBot.prototype._deleteComments.restore()
      done()
    })

    it('should fail if listOpenPullRequests failed', function (done) {
      const error = new Error('GitHub error')
      GitHub.prototype.listOpenPullRequests.yieldsAsync(error)
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }, function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should fail if _deleteComments failed', function (done) {
      const error = new Error('GitHub error')
      GitHubBot.prototype._deleteComments.yieldsAsync(error)
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }, function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should call listOpenPullRequests once', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.listOpenPullRequests)
        sinon.assert.calledWith(GitHub.prototype.listOpenPullRequests, 'CodeNow/api')
        done()
      })
    })

    it('should call _deleteComments twice', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }, function (err) {
        assert.isNull(err)
        sinon.assert.calledTwice(GitHubBot.prototype._deleteComments)
        sinon.assert.calledWith(GitHubBot.prototype._deleteComments, {
          repo: 'CodeNow/api',
          number: ctx.prs[0].number
        })
        sinon.assert.calledWith(GitHubBot.prototype._deleteComments, {
          repo: 'CodeNow/api',
          number: ctx.prs[1].number
        })
        done()
      })
    })

    it('should call functions in order', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }, function (err) {
        assert.isNull(err)
        sinon.assert.callOrder(GitHub.prototype.listOpenPullRequests,
          GitHubBot.prototype._deleteComments)
        done()
      })
    })
  })

  describe('#deleteBranchNotifications', function () {
    beforeEach(function (done) {
      ctx.prs = [
        { number: 1 },
        { number: 2 }
      ]
      ctx.gitInfo = {
        repo: 'CodeNow/api',
        branch: 'feature-1'
      }
      sinon.stub(GitHub.prototype, 'listOpenPullRequestsForBranch').yieldsAsync(null, ctx.prs)
      sinon.stub(GitHubBot.prototype, '_deleteComments').yieldsAsync(null)
      done()
    })

    afterEach(function (done) {
      ctx.prs = null
      ctx.gitInfo = null
      GitHub.prototype.listOpenPullRequestsForBranch.restore()
      GitHubBot.prototype._deleteComments.restore()
      done()
    })

    it('should fail if listOpenPullRequestsForBranch failed', function (done) {
      const error = new Error('GitHub error')
      GitHub.prototype.listOpenPullRequestsForBranch.yieldsAsync(error)
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo, function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should fail if _deleteComments failed', function (done) {
      const error = new Error('GitHub error')
      GitHubBot.prototype._deleteComments.yieldsAsync(error)
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo, function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should call listOpenPullRequestsForBranch once', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.listOpenPullRequestsForBranch)
        sinon.assert.calledWith(GitHub.prototype.listOpenPullRequestsForBranch,
          ctx.gitInfo.repo, ctx.gitInfo.branch)
        done()
      })
    })

    it('should call _deleteComments twice', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo, function (err) {
        assert.isNull(err)
        sinon.assert.calledTwice(GitHubBot.prototype._deleteComments)
        sinon.assert.calledWith(GitHubBot.prototype._deleteComments, {
          repo: ctx.gitInfo.repo,
          branch: ctx.gitInfo.branch,
          number: ctx.prs[0].number
        })
        sinon.assert.calledWith(GitHubBot.prototype._deleteComments, {
          repo: ctx.gitInfo.repo,
          branch: ctx.gitInfo.branch,
          number: ctx.prs[1].number
        })
        done()
      })
    })

    it('should call functions in order', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo, function (err) {
        assert.isNull(err)
        sinon.assert.callOrder(GitHub.prototype.listOpenPullRequestsForBranch,
          GitHubBot.prototype._deleteComments)
        done()
      })
    })
  })
})
