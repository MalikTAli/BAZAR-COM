#!/bin/bash

echo "Building Docker images for Bazar.com..."

# Build catalog image
docker build -t bazar/catalog:latest ./catalog-server

# Build order image  
docker build -t bazar/order:latest ./order-server

# Build frontend image
docker build -t bazar/frontend:latest ./frontend-server

echo "Images built successfully!"
echo "bazar/catalog:latest"
echo "bazar/order:latest"
echo "bazar/frontend:latest"