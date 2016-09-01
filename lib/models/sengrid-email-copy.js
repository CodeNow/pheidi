'use strict'

const generateSengridObject = (subject, body) => {
  return {
    en: {
      subject: 'Your infrastructure is ready',
      body: DOCK_CREATED_BODY,
      htmlBody: DOCK_CREATED_BODY
    }
  }
}

/**
 * Body messages
 */
const DOCK_CREATED_BODY = `Your infrastructure is ready.

Thanks for waiting! Now the %org% sandbox is good to go.`

const PAYMENT_METHOD_ADDED_BODY = `Your payment info has been added to %organizationName%.

We’ll charge future payments to your card for CodeNow. You can update your card anytime from Runnable, or with the button below.Thanks for waiting! Now the %organizationName% sandbox is good to go.`

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

module.exports = {
  PAYMENT_METHOD_REMOVED,
  PAYMENT_METHOD_ADDED,
  DOCK_CREATED_MESSAGES,
  TRIAL_ENDING,
  TRIAL_ENDED,
  PLAN_CHANGED,
  BILLING_ERROR_ADMIN,
  BILLING_ERROR_ALL
}
