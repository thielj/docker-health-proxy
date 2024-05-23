# docker-health-proxy

Make container status and health information available - but nothing else.

This is specifically setup for [Uptime Kuma](https://github.com/louislam/uptime-kuma)
but might be useful for other projects wanting to monitor docker containers
without exposing the full docker API or sensitive container details.


## Available APIs

Except for the two APIs below, access is denied to all other API calls.


### GET /_ping

[official docs](https://docs.docker.com/engine/api/v1.45/#tag/System/operation/SystemPing)

Use this to check if the docker daemon is alive. On success, it returns
status 200 and `OK`. Otherwise, expect a 5xx error. 


### GET /containers/{name}/json

[official docs](https://docs.docker.com/engine/api/v1.45/#tag/Container/operation/ContainerInspect)

Inspect the state of a running container. Note that the information returned
is fully redacted. The typical output for a container with health checks is:

```json
{
    "State": {
        "Status": "running",
        "Running": true,
        "Health": {
            "Status": "healthy"
        }
    }
}
```

If the container doesn't exist, you get a 404 error with a JSON
response siilar to `{"message":"No such container: trafik"}`.


## Running from the command line

As you're here to monitor docker containers, I suppose we can skip the intro.

If your docker socket is exposed as a TCP socket, you will need to pass the
NGINX_DOCKER_HOST environment. For port 2375 on your host, you probably want
this to be `host.docker.internal:2375`. NOTE: everyone who can connect to 
this port has full root access to your system.

The other option is to mount the docker socket, usually setup similar to
mine, giving access to root and every member of the `docker` group:

```sh
$ ls -l /var/run/docker.sock
srw-rw---- 1 root docker 0 May 21 13:39 /var/run/docker.sock
$ ls -ln /var/run/docker.sock
srw-rw---- 1 0 994 0 May 21 13:39 /var/run/docker.sock
$ getent group docker
docker:x:994:
```

Please note that the `docker` GID varies. Mine is 994. You need to
substitute that number with yours.

The container is already setup to be run as UID=1000. To give it access to
the mounted socket, you can either add this user to your docker group 
(`adduser $(id -nu 1000) docker`, not reccommended) or run the container
with the docker GID set like this:

```sh
sudo docker run -d -v "/var/run/docker.sock:/var/run/docker.sock:ro" \
                -u 1000:994 ghcr.io/thielj/docker-health-proxy:latest
```


## Environment variables

The following variables are used and default to:

```sh
NGINX_DOCKER_HOST=unix:/var/run/docker.sock
NGINX_LISTEN=22375
```


## Docker Compose Example

You have to replace ${DOCKER_GID} with the docker GID as described above, 
or run `DOCKER_GID=994 sudo docker compose up` or supply that variable 
through the enviroment somehow.

```yaml
# NOTE: This is a minimalist example. You probably want to make changes
#       to the setup for actual use.

services:

  docker-health-proxy:
    image: ghcr.io/thielj/docker-health-proxy:latest
    user: 1000:${DOCKER_GID}
    volumes: [ "/var/run/docker.sock:/var/run/docker.sock:ro" ]
    #extra_hosts: [ "host.docker.internal:host-gateway" ]
    #environment:
      #NGINX_DOCKER_HOST: 'unix:/var/run/docker.sock'
      #NGINX_DOCKER_HOST: 'host.docker.internal:2375'
      #NGINX_LISTEN: 22375
    #ports: [ "22375:22375" ]

  uptime-kuma:
    image: louislam/uptime-kuma:alpine
    links: [ docker-health-proxy ]
    volumes: [ /app/data ]
    ports: [ "3001:3001" ]
```

You can now open Uptime Kuma and change the docker settings to use 
`http://docker-health-proxy:22375`. Happy monitoring!