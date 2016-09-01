'use strict'

require('loadenv')()
const Promise = require('bluebird')

const CriticalError = require('error-cat/errors/critical-error')
const ErrorCat = require('error-cat')
const log = require('logger').child({ module: 'main' })
const workerServer = require('worker-server')
const rabbitmq = require('rabbitmq')
const mongodbClient = require('mongo-helper').client

Promise.join(
  mongodbClient.connectAsync(),
  rabbitmq.publisher.connect()
)
  .spread((mongoClient) => {
    log.info('rabbimq publisher started')
    return workerServer.start()
      .then(() => {
        log.info('all components started')
      })
  })
  .catch((err) => {
    log.fatal({ err: err }, 'Pheidi server failed to start')
    mongodbClient.closeAsync()
    ErrorCat.report(new CriticalError(
      'server failed to start',
      { err: err }
    ))
    process.exit(1)
  })
