## Pheidi

![Pheidi](https://upload.wikimedia.org/wikipedia/commons/thumb/2/28/Phidippides.jpg/220px-Phidippides.jpg)

Pheidi stands for [Pheidippides](https://en.wikipedia.org/wiki/Pheidippides) -
messenger who died after running Marathon to deliver message about Greek victory over Persians.


## Mission

Pheidi is a Ponos worker-sever responsible for sending all kind of notifications from Runnable to 3d party systems.

Currenly there is intgeration with Slack and GitHub Pull Requests. In the long-term we can have other providers: email, hipchat etc.

## Flow

Pheidi subscribed to the `instance.deployed` event (fired by API). Upon recieving this event Pheidi will try to: 

 - deliver message to the Slack that context version was deployed to the instance
 - deliver message deploy message to the GitHub PR page that context version was deployed to the instance
 - *COMING SOON* deliver @runnabot message on the GitHub PR page using PR comments that context version was deployed to the instance
