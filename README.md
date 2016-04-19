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

  1. `instance.deployed` event (fired by API). Upon receiving this event Pheidi will try deliver message to the Slack that context version was deployed to the instance
  2. `instance.updated` event (fired by API). Upon receiving this event Pheidi will try send 4 different types of messages using @runnabot to the appropriate GitHub PR page:
   - building - runnabot will comment on PR that instance is building
   - stopped - runnabot will comment on PR that instance is stopped (crashed or stopped manually)
   - failed - runnabot will comment on PR that instance build has failed
   - running - runnabot will comment on PR that instance running successfully
