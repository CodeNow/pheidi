'use strict'
require('loadenv')()

const Promise = require('bluebird')
const Intercom = require('./models/intercom')
const bigPoppa = require('./models/big-poppa')
const mongoClient = require('mongo-helper').client

class TestScript {
  sendIntercomMsg (githubId) {
    return bigPoppa.getOrganizations({ githubId: githubId })
      .get(0)
      .then((org) => {
        if (!org) {
          throw new WorkerStopError('Org did not exist in bigPoppa.', {}, { level: 'info' })
        }
        return [ org.name, mongoClient.findOneUserAsync({
          'accounts.github.id': org.creator.githubId
        })]
      })
      .spread((orgName, orgCreator) => {
        const email = keypather.get(orgCreator, 'email')
        return Intercom.dockCreated({ name: orgName, email: email })
          .catch((err) => {
            log.error({ err: err }, 'Failed to send email')
            throw new WorkerStopError('Failed to send email', { err: err })
          })
      })
  }
}

let script = new TestScript()
script.sendIntercomMsg(9487339)
