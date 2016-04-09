'use strict'

require('loadenv')()

const CriticalError = require('error-cat/errors/critical-error')
const ErrorCat = require('error-cat')
const log = require('./lib/logger').child({ module: 'main' })
const server = require('./lib/worker-server')

server.start()
  .then(() => {
    log.info('Pheidi Worker Server Started')
  })
  .catch((err) => {
    log.fatal({ err: err }, 'Worker server failed to start')
    ErrorCat.report(new CriticalError(
      'Pheidi Worker Server Failed to Start',
      { err: err }
    ))
    process.exit(1)
  })
