'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const sinon = require('sinon')
const noop = require('101/noop')
const GitHubDeploy = require('notifications/github.deploy')
const GitHub = require('models/github')

describe('GitHubDeploy', function () {
  const ctx = {}

  describe('#_deploymentStatus', function () {
    describe('disabled statuses', function () {
      before(function (done) {
        ctx.originalStatusFlag = process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES
        process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES = 'false'
        done()
      })

      after(function (done) {
        process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES = ctx.originalStatusFlag
        done()
      })

      it('should do nothing if statuses are disabled', function (done) {
        const githubDeploy = new GitHubDeploy('anton-token')
        const gitInfo = {
          repo: 'codenow/hellonode'
        }
        const instance = {
          name: 'inst-1',
          owner: {
            username: 'codenow'
          }
        }
        githubDeploy._deploymentStatus(gitInfo, 'some-id', 'error', 'descr',
          instance, function (error, resp) {
            assert.isNull(error)
            assert.isUndefined(resp)
            done()
          })
      })
    })

    it('should fail if deploymentId is null', function (done) {
      const githubDeploy = new GitHubDeploy('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        }
      }
      githubDeploy._deploymentStatus(gitInfo, null, 'error', 'descr',
        instance, function (error) {
          assert.isDefined(error)
          assert.equal(error.message, 'Deployment id is not found')
          done()
        })
    })
  })

  describe('#deploymentSucceeded', function () {
    it('should call github method with correct payload', function (done) {
      const githubDeploy = new GitHubDeploy('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode'
      }
      const instance = {
        name: 'inst-1',
        owner: {
          username: 'codenow'
        }
      }
      sinon.stub(GitHubDeploy.prototype, 'createDeployment', function (gitInfo, instance, cb) {
        cb(null, { id: 'deployment-id' })
      })
      sinon.stub(GitHub.prototype, 'createDeploymentStatus', function (repo, payload) {
        assert.equal(repo, gitInfo.repo)
        assert.equal(payload.id, 'deployment-id')
        assert.equal(payload.state, 'success')
        assert.equal(payload.target_url, process.env.WEB_URL + '/codenow/inst-1')
        assert.equal(payload.description, 'Deployed to inst-1 on Runnable.')
        GitHub.prototype.createDeploymentStatus.restore()
        GitHubDeploy.prototype.createDeployment.restore()
        done()
      })
      githubDeploy.deploymentSucceeded(gitInfo, instance)
    })
  })

  describe('#createDeployment', function () {
    const ctx = {}
    before(function (done) {
      ctx.originalFlag = process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES
      process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES = 'true'
      done()
    })

    after(function (done) {
      process.env.ENABLE_GITHUB_DEPLOYMENT_STATUSES = ctx.originalFlag
      done()
    })

    it('should call github method with correct payload', function (done) {
      const githubDeploy = new GitHubDeploy('anton-token')
      const gitInfo = {
        repo: 'codenow/hellonode',
        commit: 'somecommitsha'
      }
      sinon.stub(GitHub.prototype, 'createDeployment', function (repo, payload) {
        assert.equal(repo, gitInfo.repo)
        assert.isFalse(payload.auto_merge)
        assert.equal(payload.environment, 'runnable')
        assert.equal(payload.required_contexts.length, 0)
        assert.equal(payload.ref, gitInfo.commit)
        assert.equal(payload.payload, JSON.stringify({}))
        assert.equal(payload.description, 'Deploying to inst-1 on Runnable.')
        GitHub.prototype.createDeployment.restore()
        done()
      })
      githubDeploy.createDeployment(gitInfo, 'inst-1', noop)
    })
  })
})
