'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const clone = require('101/clone')
const sinon = require('sinon')
require('sinon-as-promised')(require('bluebird'))
const GitHubBot = require('notifications/github.bot')
const GitHub = require('models/github')
const tracker = require('models/tracker')

describe('GitHubBot', function () {
  const ctx = {}
  ctx.instance = {
    _id: 'inst-1-id',
    name: 'inst-1',
    owner: {
      username: 'codenow'
    },
    shortHash: 'ga71a12',
    masterPod: true
  }

  describe('#_getGitHubToken', function () {
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
      assert.throws(GitHubBot._getGitHubToken, 'Configuration error: runnabot gh access token is not defined')
      done()
    })

    it('should throw if access tokens is not string', function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = 1
      assert.throws(GitHubBot._getGitHubToken, 'Configuration error: runnabot gh access token is not defined')
      done()
    })

    it('should return empty token if tokens are empty', function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = ''
      assert.equal(GitHubBot._getGitHubToken(), '')
      done()
    })

    it('should return 1 element if one token defined', function (done) {
      process.env.RUNNABOT_GITHUB_ACCESS_TOKENS = 'token1'
      assert.equal(GitHubBot._getGitHubToken(), 'token1')
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
      assert.include(tokens, GitHubBot._getGitHubToken())
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
      sinon.stub(GitHub.prototype, 'findCommentsByUserAsync').resolves(ctx.comments)
      sinon.stub(GitHub.prototype, 'deleteCommentAsync').resolves(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.findCommentsByUserAsync.restore()
      GitHub.prototype.deleteCommentAsync.restore()
      done()
    })

    it('should fail if findCommentsByUser failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.findCommentsByUserAsync.rejects(githubError)
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo).asCallback(function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should fail if delete comment failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.deleteCommentAsync.rejects(githubError)
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo).asCallback(function (error) {
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
      githubBot._deleteComments(gitInfo).asCallback(function (error) {
        assert.isNull(error)
        sinon.assert.callOrder(GitHub.prototype.findCommentsByUserAsync, GitHub.prototype.deleteCommentAsync)
        done()
      })
    })

    it('should call findCommentsByUser with correct params', function (done) {
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo).asCallback(function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUserAsync)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUserAsync, gitInfo.repo, gitInfo.number)
        done()
      })
    })

    it('should call deletComment twice', function (done) {
      const githubBot = new GitHubBot()
      const gitInfo = {
        repo: 'codenow/hellonode',
        number: 2
      }
      githubBot._deleteComments(gitInfo).asCallback(function (error) {
        assert.isNull(error)
        sinon.assert.calledTwice(GitHub.prototype.deleteCommentAsync)
        sinon.assert.calledWith(GitHub.prototype.deleteCommentAsync, gitInfo.repo, ctx.comments[0].id)
        sinon.assert.calledWith(GitHub.prototype.deleteCommentAsync, gitInfo.repo, ctx.comments[1].id)
        done()
      })
    })
  })
  describe('#_upsertComment', function () {
    beforeEach(function (done) {
      let commentText = '<!--instanceId:' + ctx.instance._id + '-->'
      commentText += 'PR-2 is deployed to ' + ctx.instance.name
      ctx.comment = {
        body: commentText,
        id: 2
      }
      sinon.stub(GitHub.prototype, 'findCommentsByUserAsync').resolves([ctx.comment])
      sinon.stub(GitHub.prototype, 'addComment').yieldsAsync(null)
      sinon.stub(GitHub.prototype, 'deleteCommentAsync').resolves(null)
      sinon.stub(tracker, 'get').returns(null)
      sinon.stub(tracker, 'set').returns(null)
      sinon.stub(tracker, 'del').returns(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.findCommentsByUserAsync.restore()
      GitHub.prototype.addComment.restore()
      GitHub.prototype.deleteCommentAsync.restore()
      tracker.get.restore()
      tracker.set.restore()
      tracker.del.restore()
      done()
    })

    it('should fail if findCommentsByUser failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.findCommentsByUserAsync.rejects(githubError)
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

    it('should fail if deleteComment failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.deleteCommentAsync.rejects(githubError)
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
      GitHub.prototype.findCommentsByUserAsync.resolves(null)
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

    it('should call deleteComment if comment found', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      let message = '<!--instanceId:inst-1-id-->Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com)'
      message += ' to [your environment](https://web.runnable.dev/codenow/inst-1)'
      message += '\n<sub>*From [Runnable](http://runnable.com)*</sub>'
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledWith(tracker.set, 'codenow/hellonode/2/inst-1-id', message)
        sinon.assert.calledTwice(GitHub.prototype.findCommentsByUserAsync)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUserAsync,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME)
        sinon.assert.calledOnce(GitHub.prototype.deleteCommentAsync)
        sinon.assert.calledWith(GitHub.prototype.deleteCommentAsync,
          gitInfo.repo,
          ctx.comment.id)
        done()
      })
    })

    it('should call createComment if comment not found', function (done) {
      GitHub.prototype.findCommentsByUserAsync.resolves(null)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      let message = '<!--instanceId:inst-1-id-->Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com) '
      message += 'to [your environment](https://web.runnable.dev/codenow/inst-1)'
      message += '\n<sub>*From [Runnable](http://runnable.com)*</sub>'
      githubBot._upsertComment(gitInfo, ctx.instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(tracker.set)
        sinon.assert.calledWith(tracker.set, 'codenow/hellonode/2/inst-1-id', message)
        sinon.assert.calledTwice(GitHub.prototype.findCommentsByUserAsync)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUserAsync,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME)
        sinon.assert.calledOnce(GitHub.prototype.addComment)
        sinon.assert.calledWith(GitHub.prototype.addComment,
          gitInfo.repo,
          gitInfo.number
        )
        done()
      })
    })

    it('should delete cache if deleteComment failed', function (done) {
      const githubBot = new GitHubBot('anton-token')
      GitHub.prototype.deleteCommentAsync.rejects(new Error('GitHub error'))
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
      GitHub.prototype.findCommentsByUserAsync.resolves(null)
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
      const message = '<!--instanceId:inst-1-id-->Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com) to [your environment](https://web.runnable.dev/codenow/inst-1)\n<sub>*From [Runnable](http://runnable.com)*</sub>'
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
        sinon.assert.calledOnce(GitHub.prototype.findCommentsByUserAsync)
        sinon.assert.calledWith(GitHub.prototype.findCommentsByUserAsync,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME)
        sinon.assert.notCalled(GitHub.prototype.deleteCommentAsync)
        done()
      })
    })
  })
  describe('#_upsertComments', function () {
    beforeEach(function (done) {
      sinon.stub(GitHub.prototype, 'listOpenPullRequestsForBranchAsync').resolves([
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
      GitHub.prototype.listOpenPullRequestsForBranchAsync.restore()
      GitHubBot.prototype._upsertComment.restore()
      done()
    })

    it('should fail if fetching prs failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.listOpenPullRequestsForBranchAsync.rejects(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot._upsertComments(gitInfo, ctx.instance, []).asCallback(function (err) {
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
      githubBot._upsertComments(gitInfo, ctx.instance, []).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err.message, githubError.message)
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
      githubBot._upsertComments(gitInfo, ctx.instance, []).asCallback(function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.listOpenPullRequestsForBranchAsync)
        sinon.assert.calledWith(GitHub.prototype.listOpenPullRequestsForBranchAsync,
          gitInfo.repo,
          gitInfo.branch)
        sinon.assert.calledTwice(GitHubBot.prototype._upsertComment)
        const pushInfo1 = clone(gitInfo)
        pushInfo1.number = 1
        const pushInfo2 = clone(gitInfo)
        pushInfo2.number = 2
        sinon.assert.calledWith(GitHubBot.prototype._upsertComment, pushInfo1, ctx.instance, [])
        sinon.assert.calledWith(GitHubBot.prototype._upsertComment, pushInfo2, ctx.instance, [])
        done()
      })
    })
  })
  describe('#notifyOnUpdate', function () {
    beforeEach(function (done) {
      sinon.stub(GitHub.prototype, 'acceptInvitationAsync').resolves(null)
      sinon.stub(GitHubBot.prototype, '_upsertComments').resolves(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.acceptInvitationAsync.restore()
      GitHubBot.prototype._upsertComments.restore()
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
        githubBot.notifyOnUpdate(gitInfo, ctx.instance, []).asCallback(function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHub.prototype.acceptInvitationAsync)
          sinon.assert.notCalled(GitHubBot.prototype._upsertComments)
          done()
        })
      })
    })

    it('should fail if accept invitation failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.acceptInvitationAsync.rejects(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot.notifyOnUpdate(gitInfo, ctx.instance, []).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err, githubError)
        done()
      })
    })

    it('should fail if upserting comments failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHubBot.prototype._upsertComments.rejects(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      githubBot.notifyOnUpdate(gitInfo, ctx.instance, []).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err, githubError)
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
      githubBot.notifyOnUpdate(gitInfo, ctx.instance, []).asCallback(function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.acceptInvitationAsync)
        sinon.assert.calledWith(GitHub.prototype.acceptInvitationAsync, ctx.instance.owner.username)
        sinon.assert.calledOnce(GitHubBot.prototype._upsertComments)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComments, gitInfo, ctx.instance, [])
        done()
      })
    })
  })
  describe('#_render', function () {
    it('should return correct message for the running single instance', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const md = githubBot._render(gitInfo, ctx.instance)
      assert.equal(md, '<!--instanceId:inst-1-id-->Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com) to [your environment](https://web.runnable.dev/codenow/inst-1)\n<sub>*From [Runnable](http://runnable.com)*</sub>')
      done()
    })

    it('should return correct message for the isolated group', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const md = githubBot._render(gitInfo, ctx.instance, [ { name: 'inst-2', owner: { username: 'codenow' } } ])
      let message = '<!--instanceId:inst-1-id-->Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com) '
      message += 'to [your environment](https://web.runnable.dev/codenow/inst-1)'
      message += '\n<sub>Related containers: '
      message += '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9"> [inst-2](https://web.runnable.dev/codenow/inst-2)*— From [Runnable](http://runnable.com)*</sub>'
      assert.equal(md, message)
      done()
    })
  })

  describe('#_renderIsolatedInstance', function () {
    it('should return empty string if null was passed', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const md = githubBot._renderIsolatedInstance(null)
      assert.equal(md, '')
      done()
    })

    it('should return empty string if empty string was passed', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const md = githubBot._renderIsolatedInstance('')
      assert.equal(md, '')
      done()
    })

    it('should return empty string if empty array was passed', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const md = githubBot._renderIsolatedInstance([])
      assert.equal(md, '')
      done()
    })

    it('should return md with two items if array has two elements', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const insts = [
        {
          name: 'inst-1',
          owner: { username: 'codenow' }
        },
        {
          name: 'inst-2',
          owner: { username: 'codenow' }
        }
      ]
      const md = githubBot._renderIsolatedInstance(insts)
      let expectedMd = '<sub>Related containers: <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" '
      expectedMd += 'title="Failed" width="9" height="9"> [inst-1](https://web.runnable.dev/codenow/inst-1) '
      expectedMd += '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9"> [inst-2](https://web.runnable.dev/codenow/inst-2)'
      assert.equal(md, expectedMd)
      done()
    })
  })

  describe('#deleteAllNotifications', function () {
    beforeEach(function (done) {
      ctx.prs = [
        { number: 1 },
        { number: 2 }
      ]
      sinon.stub(GitHub.prototype, 'listOpenPullRequestsAsync').resolves(ctx.prs)
      sinon.stub(GitHubBot.prototype, '_deleteComments').resolves(null)
      done()
    })

    afterEach(function (done) {
      ctx.prs = [
        { number: 1 },
        { number: 2 }
      ]
      GitHub.prototype.listOpenPullRequestsAsync.restore()
      GitHubBot.prototype._deleteComments.restore()
      done()
    })

    it('should fail if listOpenPullRequests failed', function (done) {
      const error = new Error('GitHub error')
      GitHub.prototype.listOpenPullRequestsAsync.rejects(error)
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should fail if _deleteComments failed', function (done) {
      const error = new Error('GitHub error')
      GitHubBot.prototype._deleteComments.rejects(error)
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should call listOpenPullRequests once', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }).asCallback(function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.listOpenPullRequestsAsync)
        sinon.assert.calledWith(GitHub.prototype.listOpenPullRequestsAsync, 'CodeNow/api')
        done()
      })
    })

    it('should call _deleteComments twice', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }).asCallback(function (err) {
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
      githubBot.deleteAllNotifications({ repo: 'CodeNow/api' }).asCallback(function (err) {
        assert.isNull(err)
        sinon.assert.callOrder(GitHub.prototype.listOpenPullRequestsAsync,
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
      sinon.stub(GitHub.prototype, 'listOpenPullRequestsForBranchAsync').resolves(ctx.prs)
      sinon.stub(GitHubBot.prototype, '_deleteComments').resolves(null)
      done()
    })

    afterEach(function (done) {
      ctx.prs = null
      ctx.gitInfo = null
      GitHub.prototype.listOpenPullRequestsForBranchAsync.restore()
      GitHubBot.prototype._deleteComments.restore()
      done()
    })

    it('should fail if listOpenPullRequestsForBranch failed', function (done) {
      const error = new Error('GitHub error')
      GitHub.prototype.listOpenPullRequestsForBranchAsync.rejects(error)
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should fail if _deleteComments failed', function (done) {
      const error = new Error('GitHub error')
      GitHubBot.prototype._deleteComments.rejects(error)
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo).asCallback(function (err) {
        assert.isDefined(err)
        assert.equal(err, error)
        done()
      })
    })

    it('should call listOpenPullRequestsForBranch once', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo).asCallback(function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.listOpenPullRequestsForBranchAsync)
        sinon.assert.calledWith(GitHub.prototype.listOpenPullRequestsForBranchAsync,
          ctx.gitInfo.repo, ctx.gitInfo.branch)
        done()
      })
    })

    it('should call _deleteComments twice', function (done) {
      const githubBot = new GitHubBot()
      githubBot.deleteBranchNotifications(ctx.gitInfo).asCallback(function (err) {
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
      githubBot.deleteBranchNotifications(ctx.gitInfo).asCallback(function (err) {
        assert.isNull(err)
        sinon.assert.callOrder(GitHub.prototype.listOpenPullRequestsForBranchAsync,
          GitHubBot.prototype._deleteComments)
        done()
      })
    })
  })
  describe('_renderStatusIcon', () => {
    it('should return correct icon for running state', () => {
      const githubBot = new GitHubBot()
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9">',
        githubBot._renderStatusIcon('running')
      )
    })

    it('should return correct icon for stopped state', () => {
      const githubBot = new GitHubBot()
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-gray.svg" title="Stopped" width="9" height="9">',
        githubBot._renderStatusIcon('stopped')
      )
    })

    it('should return correct icon for building state', () => {
      const githubBot = new GitHubBot()
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-orange.svg" title="Building" width="9" height="9">',
        githubBot._renderStatusIcon('building')
      )
    })

    it('should return errored icon as default', () => {
      const githubBot = new GitHubBot()
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9">',
        githubBot._renderStatusIcon('error')
      )
    })
  })
})
