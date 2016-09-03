'use strict'
require('loadenv')()

const BigPoppaClient = require('@runnable/big-poppa-client')

module.exports = new BigPoppaClient(process.env.BIG_POPPA_HOST)
