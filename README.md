## Pheidi

[![js-standard-style](https://img.shields.io/badge/code%20style-standard-brightgreen.svg)](http://standardjs.com/)


![Pheidi](https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Phidippides.jpg/220px-Phidippides.jpg)

Pheidi stands for [Pheidippides](https://en.wikipedia.org/wiki/Pheidippides) -
messenger who died after running Marathon to deliver message about Greek victory over Persians.


## Mission

Pheidi is a Ponos worker-sever responsible for sending all kind of notifications from Runnable to 3d party systems.

Currently there is integration with Slack and GitHub Pull Requests. In the long-term we can have other providers: email, hipchat etc.


## Flow

Pheidi subscribed to:

  1. `instance.deployed` event (fired by API).
    - Deliver message to the Slack that context version was deployed to the instance
  2. `instance.updated` event (fired by API). 
    - Send 4 different types of messages using @runnabot to the appropriate GitHub PR page:
      - building 
        - runnabot will comment on PR that instance is building
      - stopped 
        - runnabot will comment on PR that instance is stopped (crashed or stopped manually)
      - failed 
        - runnabot will comment on PR that instance build has failed
      - running
        - runnabot will comment on PR that instance running successfully
  3. `instance.deleted` event (fired by API).
    - Delete @runnabot messages for the linked PR (if forked instance is being deleted) or PRs (if master instance is being deleted) 
  5. `container.life-cycle.started` event (fired by Docker Listener).
    - Mark the commit in github as `pending`
  6. `container.life-cycle.died` event (fired by Docker Listener). 
    - If build container and status is failure mark commit in github as `failed`.
    - If user container and status is 0 mark commit in github as `success`
    - If user container and status is non 0 mark commit in github as `error`
  7. `organization.trial.ended`
    - If the trial for an organization has ended
  8. `organization.trial.ending`
    - If the trial for an organization is ending
