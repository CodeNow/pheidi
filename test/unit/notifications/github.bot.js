'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
const GitHubBot = require('notifications/github.bot')
const GitHub = require('models/github')

describe('GitHubBot', function () {
  const ctx = {}
  describe('#upsertComment', function () {
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
      githubBot.upsertComment(gitInfo, instance, function (error) {
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
      githubBot.upsertComment(gitInfo, instance, function (error) {
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
      githubBot.upsertComment(gitInfo, instance, function (error) {
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
      githubBot.upsertComment(gitInfo, instance, function (error) {
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
      githubBot.upsertComment(gitInfo, instance, function (error) {
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
      githubBot.upsertComment(gitInfo, instance, function (error) {
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
})
