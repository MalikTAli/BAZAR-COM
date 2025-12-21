#!/bin/bash

# Scale catalog service to 3 replicas
docker service scale bazar_catalog=3

# Scale order service to 3 replicas
docker service scale bazar_order=3

echo "Services scaled:"
docker service ls
