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
      githubBot._upsertComment(gitInfo, instance, function (error) {
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
      githubBot._upsertComment(gitInfo, instance, function (error) {
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
      githubBot._upsertComment(gitInfo, instance, function (error) {
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
      githubBot._upsertComment(gitInfo, instance, function (error) {
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
      githubBot._upsertComment(gitInfo, instance, function (error) {
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
      githubBot._upsertComment(gitInfo, instance, function (error) {
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
      githubBot._upsertComments(gitInfo, instance, function (err) {
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
      githubBot._upsertComments(gitInfo, instance, function (err) {
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
      githubBot._upsertComments(gitInfo, instance, function (err) {
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
          pushInfo1, instance, sinon.match.func)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComment,
          pushInfo2, instance, sinon.match.func)
        done()
      })
    })
  })
  describe('#notifyOnAutoDeploy', function () {
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
        githubBot.notifyOnAutoDeploy(gitInfo, instance, function (err) {
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
      githubBot.notifyOnAutoDeploy(gitInfo, instance, function (err) {
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
      githubBot.notifyOnAutoDeploy(gitInfo, instance, function (err) {
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
      githubBot.notifyOnAutoDeploy(gitInfo, instance, function (err) {
        assert.isNull(err)
        sinon.assert.calledOnce(GitHub.prototype.acceptInvitation)
        sinon.assert.calledWith(GitHub.prototype.acceptInvitation,
          instance.owner.username,
          sinon.match.func)
        sinon.assert.calledOnce(GitHubBot.prototype._upsertComments)
        sinon.assert.calledWith(GitHubBot.prototype._upsertComments,
          gitInfo, instance, sinon.match.func)
        done()
      })
    })
  })
  describe('#_render', function () {
    it('should return message with one link', function (done) {
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
      const md = githubBot._render(gitInfo, instance)
      assert.equal(md, 'The latest push to PR-2 is running on [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com?ref=pr)')
      done()
    })
  })
})
