'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const GitHubBotMessage = require('notifications/github.bot.message')

describe('GitHubBotMessage', () => {
  const ctx = {}
  ctx.instance = {
    _id: 'inst-1-id',
    name: 'feature-1-hellonode',
    owner: {
      username: 'codenow'
    },
    shortHash: 'ga71a12',
    masterPod: true,
    contextVersions: [
      {
        appCodeVersions: [
          {
            branch: 'feature-1'
          }
        ]
      }
    ]
  }
  describe('#_render', () => {
    it('should return correct message for the running single instance', (done) => {
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const md = GitHubBotMessage.render(gitInfo, ctx.instance)
      assert.equal(md, '<!-- ' + process.env.NO_CLUSTER_ID_NAME + ' -->\nDeployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [hellonode](http://ga71a12-feature-1-hellonode-staging-codenow.runnableapp.com).\n<sub>*[View on Runnable](https://web.runnable.dev/codenow/feature-1-hellonode)*</sub>')
      done()
    })

    it('should return correct message for the isolated group', (done) => {
      const gitInfo = {
        repo: 'codenow/node-starter',
        branch: 'b17',
        state: 'running',
        number: 33
      }
      ctx.instance.name = 'b17-node-starter-4-web'
      const clusterInstance = Object.assign(ctx.instance, {inputClusterConfig: { _id: 'sohail-cluster-id', clusterName: 'node-starter-4' }})
      const md = GitHubBotMessage.render(gitInfo, clusterInstance, [ { name: 'ga71a12-b17-node-starter-4-db', owner: { username: 'codenow' } } ])
      let message = '<!-- sohail-cluster-id -->\nDeployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [web](http://ga71a12-b17-node-starter-4-web-staging-codenow.runnableapp.com), '
      message += '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" '
      message += 'title="Failed" width="9" height="9"> [db](http://ga71a12-b17-node-starter-4-db-staging-codenow.runnableapp.com).'
      message += '\n<sub>*[View on Runnable](https://web.runnable.dev/codenow/b17-node-starter-4-web)*</sub>'
      assert.equal(md, message)
      done()
    })
  })

  describe('#_renderIsolatedInstance', () => {
    it('should return empty string if null was passed', (done) => {
      const md = GitHubBotMessage.renderIsolatedInstance(null)
      assert.equal(md, '')
      done()
    })

    it('should return empty string if empty string was passed', (done) => {
      const md = GitHubBotMessage.renderIsolatedInstance('')
      assert.equal(md, '')
      done()
    })

    it('should return empty string if empty array was passed', (done) => {
      const md = GitHubBotMessage.renderIsolatedInstance([])
      assert.equal(md, '')
      done()
    })

    it('should return md with two items if array has two elements', (done) => {
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
      const md = GitHubBotMessage.renderIsolatedInstance(insts)
      let expectedMd = '<sub>Related containers: '
      expectedMd += '[inst-1](https://web.runnable.dev/codenow/inst-1), '
      expectedMd += '[inst-2](https://web.runnable.dev/codenow/inst-2)'
      assert.equal(md, expectedMd)
      done()
    })
  })
  describe('_renderStatusIcon', () => {
    it('should return correct icon for running state', () => {
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9">',
        GitHubBotMessage.renderStatusIcon('running')
      )
    })

    it('should return correct icon for stopped state', () => {
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-gray.svg" title="Stopped" width="9" height="9">',
        GitHubBotMessage.renderStatusIcon('stopped')
      )
    })

    it('should return correct icon for building state', () => {
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-orange.svg" title="Building" width="9" height="9">',
        GitHubBotMessage.renderStatusIcon('building')
      )
    })

    it('should return errored icon as default', () => {
      assert.equal(
        '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9">',
        GitHubBotMessage.renderStatusIcon('error')
      )
    })
  })
})
