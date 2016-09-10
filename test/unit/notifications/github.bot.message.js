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
      assert.equal(md, 'Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [hellonode/feature-1](http://ga71a12-feature-1-hellonode-staging-codenow.runnableapp.com). [View on Runnable](https://web.runnable.dev/codenow/feature-1-hellonode).\n<sub>*From [Runnable](http://runnable.com)*</sub>')
      done()
    })

    it('should return correct message for the isolated group', (done) => {
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const md = GitHubBotMessage.render(gitInfo, ctx.instance, [ { name: 'inst-2', owner: { username: 'codenow' } } ])
      let message = 'Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" '
      message += 'title="Running" width="9" height="9"> [hellonode/feature-1](http://ga71a12-feature-1-hellonode-staging-codenow.runnableapp.com). '
      message += '[View on Runnable](https://web.runnable.dev/codenow/feature-1-hellonode).'
      message += '\n<sub>Related containers: '
      message += '[inst-2](https://web.runnable.dev/codenow/inst-2)*— From [Runnable](http://runnable.com)*</sub>'
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
