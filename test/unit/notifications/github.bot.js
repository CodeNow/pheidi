'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const clone = require('101/clone')
const sinon = require('sinon')
const GitHubBot = require('notifications/github.bot')
const GitHub = require('models/github')

describe('GitHubBot', function () {
  const ctx = {}

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
        body: 'PR-2 is deployed',
        id: 2
      }
      sinon.stub(GitHub.prototype, 'findCommentByUser').yieldsAsync(null, ctx.comment)
      sinon.stub(GitHub.prototype, 'addComment').yieldsAsync(null)
      sinon.stub(GitHub.prototype, 'updateComment').yieldsAsync(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.findCommentByUser.restore()
      GitHub.prototype.addComment.restore()
      GitHub.prototype.updateComment.restore()
      done()
    })

    it('should fail if findCommentByUser failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.findCommentByUser.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComment(gitInfo, instance, [], function (error) {
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComment(gitInfo, instance, [], function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
        done()
      })
    })

    it('should fail if addComment failed', function (done) {
      GitHub.prototype.findCommentByUser.yieldsAsync(null, null)
      const githubError = new Error('GitHub error')
      GitHub.prototype.addComment.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComment(gitInfo, instance, [], function (error) {
        assert.isDefined(error)
        assert.equal(error, githubError)
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComment(gitInfo, instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(GitHub.prototype.findCommentByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentByUser,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME,
          sinon.match.func)
        sinon.assert.calledOnce(GitHub.prototype.updateComment)
        sinon.assert.calledWith(GitHub.prototype.updateComment,
          gitInfo.repo,
          ctx.comment.id,
          'The latest push to PR-2 is running on [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com?ref=pr)',
          sinon.match.func)
        done()
      })
    })

    it('should call createComment if comment not found', function (done) {
      GitHub.prototype.findCommentByUser.yieldsAsync(null, null)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComment(gitInfo, instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(GitHub.prototype.findCommentByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentByUser,
          gitInfo.repo,
          gitInfo.number,
          process.env.RUNNABOT_GITHUB_USERNAME,
          sinon.match.func)
        sinon.assert.calledOnce(GitHub.prototype.addComment)
        sinon.assert.calledWith(GitHub.prototype.addComment,
          gitInfo.repo,
          gitInfo.number,
          'The latest push to PR-2 is running on [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com?ref=pr)',
          sinon.match.func
        )
        done()
      })
    })

    it('should not update comment if comment did not change', function (done) {
      GitHub.prototype.findCommentByUser.yieldsAsync(null, {
        body: 'The latest push to PR-2 is running on [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com?ref=pr)',
        id: 2
      })
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComment(gitInfo, instance, [], function (error) {
        assert.isNull(error)
        sinon.assert.calledOnce(GitHub.prototype.findCommentByUser)
        sinon.assert.calledWith(GitHub.prototype.findCommentByUser,
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComments(gitInfo, instance, [], function (err) {
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComments(gitInfo, instance, [], function (err) {
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot._upsertComments(gitInfo, instance, [], function (err) {
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
          pushInfo1, instance, [], sinon.match.func)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComment,
          pushInfo2, instance, [], sinon.match.func)
        done()
      })
    })
  })
  describe('#notifyOnUpdate', function () {
    beforeEach(function (done) {
      sinon.stub(GitHub.prototype, 'acceptInvitation').yieldsAsync(null)
      sinon.stub(GitHubBot.prototype, '_upsertComments').yieldsAsync(null)
      done()
    })

    afterEach(function (done) {
      GitHub.prototype.acceptInvitation.restore()
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
        const instance = {
          name: 'inst-1',
          owner: {
            username: 'codenow'
          },
          shortHash: 'ga71a12',
          masterPod: true
        }
        githubBot.notifyOnUpdate(gitInfo, instance, [], function (err) {
          assert.isNull(err)
          sinon.assert.notCalled(GitHub.prototype.acceptInvitation)
          sinon.assert.notCalled(GitHubBot.prototype._upsertComments)
          done()
        })
      })
    })

    it('should fail if accept invitation failed', function (done) {
      const githubError = new Error('GitHub error')
      GitHub.prototype.acceptInvitation.yieldsAsync(githubError)
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot.notifyOnUpdate(gitInfo, instance, [], function (err) {
        assert.isDefined(err)
        assert.equal(err, githubError)
        done()
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot.notifyOnUpdate(gitInfo, instance, [], function (err) {
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      githubBot.notifyOnUpdate(gitInfo, instance, [], function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.acceptInvitation)
        sinon.assert.calledWith(GitHub.prototype.acceptInvitation,
          instance.owner.username,
          sinon.match.func)
        sinon.assert.calledOnce(GitHubBot.prototype._upsertComments)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComments,
          gitInfo, instance, [], sinon.match.func)
        done()
      })
    })
  })
  describe('#_render', function () {
    it('should return correct message for the running state', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      const md = githubBot._render(gitInfo, instance)
      assert.equal(md, 'The latest push to PR-2 is running on [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com?ref=pr)')
      done()
    })

    it('should return correct message for the building state', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'building'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      const md = githubBot._render(gitInfo, instance)
      assert.equal(md, 'The latest push to PR-2 is building. Check out the logs [inst-1](https://web.runnable.dev/codenow/inst-1?ref=pr)')
      done()
    })

    it('should return correct message for the stopped state', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'stopped'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      const md = githubBot._render(gitInfo, instance)
      assert.equal(md, 'The latest push to PR-2 has stopped. Check out the logs [inst-1](https://web.runnable.dev/codenow/inst-1?ref=pr)')
      done()
    })

    it('should return correct message for the failed state', function (done) {
      const githubBot = new GitHubBot('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'failed'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      const md = githubBot._render(gitInfo, instance)
      assert.equal(md, 'The latest push to PR-2 has failed to build. Check out the logs [inst-1](https://web.runnable.dev/codenow/inst-1?ref=pr)')
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
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        },
        shortHash: 'ga71a12',
        masterPod: true
      }
      const md = githubBot._render(gitInfo, instance, [ { name: 'inst-2', owner: { username: 'codenow' } } ])
      var result = 'The latest push to PR-2 is running on [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com?ref=pr)'
      result += '\n\nIsolated instances:\n - [inst-2](https://web.runnable.dev/codenow/inst-2?ref=pr)'
      assert.equal(md, result)
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
