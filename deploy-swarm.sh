#!/bin/bash

echo "Deploying Bazar.com on Docker Swarm..."

# Initialize swarm if not already initialized
if ! docker node ls &> /dev/null; then
    echo "Initializing Docker Swarm..."
    docker swarm init
fi

# Deploy stack
docker stack deploy -c docker-swarm.yml bazar

echo "Deployment complete!"
echo "Services will be available at:"
echo "  Frontend: http://localhost:3002"
echo "  Catalog: http://localhost:3001"
echo "  Order: http://localhost:3000"
echo ""
echo "Check status with: docker service ls"
echo "Scale services with: docker service scale bazar_catalog=3"
