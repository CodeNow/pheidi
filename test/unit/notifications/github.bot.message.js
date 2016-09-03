'use strict'

const chai = require('chai')
chai.use(require('chai-as-promised'))
const assert = chai.assert
const GitHubBotMessage = require('notifications/github.bot.message')

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

  describe('#render', function () {
    it('should return correct message for the running single instance', function (done) {
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const md = GitHubBotMessage.render(gitInfo, ctx.instance)
      assert.equal(md, '<!--instanceId:inst-1-id-->Deployed <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-green.svg" title="Running" width="9" height="9"> [inst-1](http://ga71a12-inst-1-staging-codenow.runnableapp.com) to [your environment](https://web.runnable.dev/codenow/inst-1)\n<sub>*From [Runnable](http://runnable.com)*</sub>')
      done()
    })

    it('should return correct message for the isolated group', function (done) {
      const gitInfo = {
        repo: 'codenow/hellonode',
        branch: 'feature-1',
        number: 2,
        state: 'running'
      }
      const md = GitHubBotMessage.render(gitInfo, ctx.instance, [ { name: 'inst-2', owner: { username: 'codenow' } } ])
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
      const md = GitHubBotMessage.renderIsolatedInstance(null)
      assert.equal(md, '')
      done()
    })

    it('should return empty string if empty string was passed', function (done) {
      const md = GitHubBotMessage.renderIsolatedInstance('')
      assert.equal(md, '')
      done()
    })

    it('should return empty string if empty array was passed', function (done) {
      const md = GitHubBotMessage.renderIsolatedInstance([])
      assert.equal(md, '')
      done()
    })

    it('should return md with two items if array has two elements', function (done) {
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
      let expectedMd = '<sub>Related containers: <img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" '
      expectedMd += 'title="Failed" width="9" height="9"> [inst-1](https://web.runnable.dev/codenow/inst-1) '
      expectedMd += '<img src="https://s3-us-west-1.amazonaws.com/runnable-design/status-red.svg" title="Failed" width="9" height="9"> [inst-2](https://web.runnable.dev/codenow/inst-2)'
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
