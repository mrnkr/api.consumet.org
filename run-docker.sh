#!/bin/zsh

host_ip=`ifconfig | grep "inet " | grep -v 127.0.0.1 | awk '{print $2}' | head -1`

docker run --rm -p 3000:3000 -p 8888:8888/udp -e REDIS_HOST=host.docker.internal -e REDIS_PORT=6379 -e NODE_ENV=PROD -e HOST_IP=$host_ip consumet-api:distroless
