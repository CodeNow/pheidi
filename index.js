'use strict'

require('loadenv')()

const Promise = require('bluebird')
const CriticalError = require('error-cat/errors/critical-error')
const ErrorCat = require('error-cat')
const log = require('logger').child({ module: 'main' })
const server = require('worker-server')
const queueServer = require('queue-worker-server')
const rabbitmq = require('rabbitmq')

Promise.all([
  queueServer.start,
  server.start,
  rabbitmq.publisher.connectAsync
])
.then(() => {
  log.info('Pheidi Server Started')
})
.catch((err) => {
  log.fatal({ err: err }, 'Server failed to start')
  ErrorCat.report(new CriticalError(
    'Pheidi Worker Server Failed to Start',
    { err: err }
  ))
  process.exit(1)
})
