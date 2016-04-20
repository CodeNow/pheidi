'use strict'

require('loadenv')()

const CriticalError = require('error-cat/errors/critical-error')
const ErrorCat = require('error-cat')
const log = require('logger').child({ module: 'main' })
const server = require('worker-server')
const queueServer = require('queue-worker-server')
const rabbitmq = require('rabbitmq')

rabbitmq.publisher.connectAsync()
  .then(() => {
    server.start()
      .then(() => {
        queueServer.start()
          .then(() => {
            log.info('Pheidi server started')
          })
      })
  })
  .catch((err) => {
    log.fatal({ err: err }, 'Pheidi server failed to start')
    ErrorCat.report(new CriticalError(
      'Pheidi server failed to start',
      { err: err }
    ))
    process.exit(1)
  })
