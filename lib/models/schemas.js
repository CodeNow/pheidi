'use strict'

const joi = require('joi')

exports.containerLifeCycleEvent = joi.object({
  id: joi.string().required(),
  needsInspect: joi.boolean().required(),
  inspectData: joi.object({
    Config: joi.object({
      Labels: joi.object({
        type: joi.string().required(),
        'contextVersionId': joi.alternatives()
          .when('type', {
            is: 'user-container',
            then: joi.string().required()
          })
          .when('type', {
            is: 'image-builder-container',
            then: joi.string().required()
          }),
        'contextVersion._id': joi.alternatives().when('type', {
          is: 'image-builder-container',
          then: joi.string().required()
        })
      }).unknown().required()
    }).unknown().required()
  }).unknown().when('needsInspect', { is: true, then: joi.required() })
}).unknown().required()

exports.githubBotNotify = joi.object({
  pushInfo: joi.object({
    repo: joi.string().required(),
    branch: joi.string().required(),
    state: joi.string().required()
  }).required(),
  instance: joi.object({
    owner: joi.object({
      github: joi.number().required()
    }).unknown().required(),
    contextVersions: joi.array().items(
      joi.object().unknown().label('context version')).required()
  }).unknown().required()
}).unknown().required()

exports.githubPullRequestOpened = joi.object({
  payload: joi.object({
    pull_request: joi.object({
      head: joi.object({
        ref: joi.string().required(),
        repo: joi.object({
          full_name: joi.string().required()
        }).unknown().required()
      }).unknown().required()
    }).unknown().required()
  }).unknown().required()
}).unknown().required()

exports.paymentMethodChange = joi.object({
  organization: joi.object({
    name: joi.string().required()
  }).unknown().required(),
  paymentMethodOwner: joi.object({
    githubId: joi.number().required()
  }).unknown().required()
}).unknown().required()

exports.instanceChange = joi.object({
  instance: joi.object({
    owner: joi.object({
      github: joi.number().required()
    }).unknown().required(),
    contextVersion: joi.object({
      appCodeVersions: joi.array().items(
        joi.object({
          repo: joi.string().required(),
          branch: joi.string().required()
        }).unknown().label('app code version')
      ).required()
    }).unknown().required().label('context version')
  }).unknown().required()
}).unknown().required()

exports.trialEvent = joi.object({
  organization: joi.object({
    id: joi.number().required(),
    name: joi.string().required()
  }).unknown().required()
}).unknown().required()
