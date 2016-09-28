'use strict'

const generateSengridObject = (subject, body) => {
  return {
    en: {
      subject: subject,
      body: DOCK_CREATED_BODY,
      htmlBody: DOCK_CREATED_BODY
    }
  }
}

/**
 * Body messages
 */
const DOCK_CREATED_BODY = `Your infrastructure is ready.

Thanks for waiting! Now the %org% environment is good to go.`

const PAYMENT_METHOD_ADDED_BODY = `Your payment info has been added to %organizationName%.

We’ll charge future payments to your card for %organizationName%. You can update your card anytime from Runnable, or with the button below. Thanks for waiting! Now the %organizationName% environment is good to go.`

const PAYMENT_METHOD_REMOVED_BODY = `Your payment info has been removed from %organizationName%.

Just wanted to let you know that your payment info has been removed by someone else on your team and your card will not be charged on the next bill.`

const TRIAL_ENDING_BODY = `Your free trial is ending in 3 days.

Upgrade your plan so you and the rest of the %organizationName% org can keep using Runnable.`

const TRIAL_ENDED_BODY = `Your free trial has ended.

%organizationName%‘s account on Runnable has been paused. But don’t worry; we’ll keep everything just as you left it. Upgrade your plan to pick up right where you left off.`

const PLAN_CHANGED_BODY = `Your Runnable plan has changed.

A member of your org has added new configurations which put you in the %currentPlanName% plan @ $%planCost%/user/month.

We won’t start charging you for this plan until your next billing period on %billingDate%. Until then, you can return to the %previousPlanName% plan without incurring additional charges.`

const BILLING_ERROR_ADMIN_BODY = `Your payment has been declined.

We tried to process the subscription for %organizationName% using the card you supplied, but it was declined.

Please update it soon to ensure uninterrupted service. If we don’t receive payment within 72 hours, we’ll pause your containers until the balance is paid.`

const BILLING_ERROR_ALL_BODY = `Your payment has been declined.

We tried to process the subscription for %organizationName%, but the card was declined.

Please update it soon to ensure uninterrupted service. If we don’t receive payment within 48 hours, we’ll pause your containers until the balance is paid.`

const WELCOME_EMAIL_FOR_ORGANIZATION_BODY = `Hi %userName%,

Thanks for signing up! We’re very excited for you to begin accelerating %organizationName%’s development with full-stack environments for every branch.

Your full-featured trial is free for the next 14 days. Simply add a payment method under the Settings menu to continue using Runnable without interruption.

While you’re getting set up, check out our Documentation for answers to common questions and examples for setting up popular stacks. Our Dev-Ops experts are here to help in case you get stuck — reach us via the in-app chat messenger or by replying to this email.

Cheers,

Team Runnable
`

const USER_ADDED_TO_ORG_BODY = `Hi %userName%,

Welcome to %organizationName%’s team on Runnable! We’re very excited for you to accelerate your development with full-stack environments for every branch.

As you’re exploring our features, check out our Documentation for answers to common questions and examples for setting up popular stacks. Our Dev-Ops experts are here to help in case you get stuck — reach us via the in-app chat messenger or by replying to this email.

Cheers,

Team Runnable`

/**
 * Message objects
 */

const DOCK_CREATED_MESSAGES = generateSengridObject('Your infrastructure is ready', DOCK_CREATED_BODY)
const PAYMENT_METHOD_ADDED = generateSengridObject('Your payment method has been added', PAYMENT_METHOD_ADDED_BODY)
const PAYMENT_METHOD_REMOVED = generateSengridObject('Your payment method has been removed', PAYMENT_METHOD_REMOVED_BODY)
const TRIAL_ENDING = generateSengridObject('Your free trial is ending in 3 days.', TRIAL_ENDING_BODY)
const TRIAL_ENDED = generateSengridObject('Your free trial has ended.', TRIAL_ENDED_BODY)
const PLAN_CHANGED = generateSengridObject('Your Runnable plan has changed.', PLAN_CHANGED_BODY)
const BILLING_ERROR_ADMIN = generateSengridObject('Your payment has been declined.', BILLING_ERROR_ADMIN_BODY)
const BILLING_ERROR_ALL = generateSengridObject('Your payment has been declined.', BILLING_ERROR_ALL_BODY)
const WELCOME_EMAIL_FOR_ORGANIZATION = generateSengridObject('Welcome to Runnable!', WELCOME_EMAIL_FOR_ORGANIZATION_BODY)
const USER_ADDED_TO_ORG = generateSengridObject('Welcome to Runnable!', USER_ADDED_TO_ORG_BODY)

module.exports = {
  DOCK_CREATED_MESSAGES,
  PAYMENT_METHOD_REMOVED,
  PAYMENT_METHOD_ADDED,
  TRIAL_ENDING,
  TRIAL_ENDED,
  PLAN_CHANGED,
  BILLING_ERROR_ADMIN,
  BILLING_ERROR_ALL,
  WELCOME_EMAIL_FOR_ORGANIZATION,
  USER_ADDED_TO_ORG
}
