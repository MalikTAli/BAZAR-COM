# BAZAR-COM

A microservices-based distributed online bookstore application built with Node.js and Docker. The system implements advanced distributed systems concepts including service replication, caching, load balancing, and strong consistency.

## 📚 Features

### Core Architecture
- **Microservices Architecture**: Independent, scalable services (Frontend, Catalog, Order)
- **Service Replication**: 2 replicas each for Catalog and Order services (Lab 2)
- **Load Balancing**: Round-robin distribution across replicas
- **In-Memory Caching**: NodeCache with TTL and LRU support
- **Strong Consistency**: Server-push cache invalidation before writes
- **Replica Synchronization**: Automatic sync across catalog replicas

### Development & Operations
- **Docker Support**: Full containerization with Docker Compose and Swarm
- **Health Checks**: Built-in health monitoring for all services
- **Performance Monitoring**: Built-in metrics and health checks
- **Error Handling**: Comprehensive error handling and validation
- **Request Logging**: Detailed request/response logging
- **Graceful Shutdown**: Proper cleanup on service termination
- **CORS Enabled**: Cross-origin resource sharing support

## 🏗️ Architecture

The application follows a microservices architecture with three main services:

```
Client
  ↓
Frontend Service (Port 3002)
  - API Gateway
  - Load Balancer
  - Cache Manager
  ↓
├─→ Catalog Service (Port 3001) - Replica 1 & 2
│     - Book Database
│     - Search & Info
│     - Stock Management
│
└─→ Order Service (Port 3000) - Replica 1 & 2
      - Order Processing
      - Purchase Logic
      - Order History
```

### Service Details

| Service  | Port | Replicas | Responsibilities |
|----------|------|----------|------------------|
| Frontend | 3002 | 1        | API Gateway, Load Balancing, Caching |
| Catalog  | 3001 | 2        | Book inventory, search, stock updates |
| Order    | 3000 | 2        | Purchase orders, order history |

## 📖 Book Catalog

| ID | Title | Topic | Price | Stock |
|----|-------|-------|-------|-------|
| 1 | How to get a good grade in DOS in 40 minutes a day | Distributed Systems | $100 | 18 |
| 2 | RPCs for Noobs | Distributed Systems | $100 | 19 |
| 3 | Xen and the Art of Surviving Undergraduate School | Undergraduate | $25 | 10 |
| 4 | Cooking for the Impatient Undergrad | Undergraduate | $20 | 9 |
| 5 | **How to finish Project 3 on time** | Project Management | $150 | 15 |
| 6 | **Why theory classes are so hard** | Theory | $120 | 20 |
| 7 | **Spring in the Pioneer Valley** | Spring | $80 | 25 |

*Books 5-7 added in Lab 2*

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ (for local development)
- Docker Desktop (Windows/Mac/Linux)
- PowerShell (for Windows testing scripts)
- Git

### Option 1: Docker Compose (Development)

```bash
# Clone the repository
git clone https://github.com/MalikTAli/BAZAR-COM.git
cd BAZAR-COM

# Build and start all services
docker-compose up --build -d

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend

# Stop services
docker-compose down
```

### Option 2: Docker Swarm (Production)

```bash
# Initialize swarm
docker swarm init

# Build images
./build-images.sh

# Deploy with replicas
./deploy-swarm.sh

# Scale services
./scale-services.sh

# Check status
docker service ls

# Remove deployment
docker stack rm bazar
```

### Option 3: Local Development

#### Catalog Service
```bash
cd catalog-server
npm install
npm start
```

#### Order Service
```bash
cd order-server
npm install
# Set environment variables (PowerShell)
$env:PORT="3000"
$env:CATALOG_SERVICE_URL="http://localhost:3001"
npm start
```

#### Frontend Service
```bash
cd frontend-server
npm install
# Set environment variables (PowerShell)
$env:PORT="3002"
$env:CATALOG_SERVICE_URL="http://localhost:3001"
$env:ORDER_SERVICE_URL="http://localhost:3000"
node app.js
```

## 📡 API Endpoints

### Frontend Service (API Gateway - http://localhost:3002)

#### Search Books
```http
GET /search/:topic
```
Search for books by topic. Results are cached.

**Example:**
```bash
curl http://localhost:3002/search/distributed%20systems
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3002/search/distributed systems"
```

**Response:**
```json
{
  "success": true,
  "count": 2,
  "data": [
    {
      "id": "1",
      "title": "How to get a good grade in DOS in 40 minutes a day"
    }
  ]
}
```

#### Get Book Info
```http
GET /info/:id
```
Get detailed information about a specific book. Results are cached.

**Example:**
```bash
curl http://localhost:3002/info/1
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3002/info/1"
```

**Response:**
```json
{
  "success": true,
  "data": {
    "title": "How to get a good grade in DOS in 40 minutes a day",
    "quantity": 10,
    "price": 30
  }
}
```

#### Purchase Book
```http
POST /purchase/:id
```
Purchase a book by ID. Invalidates cache before purchase.

**Example:**
```bash
curl -X POST http://localhost:3002/purchase/1
# PowerShell
Invoke-RestMethod -Uri "http://localhost:3002/purchase/5" -Method POST
```

**Response:**
```json
{
  "success": true,
  "data": {
    "message": "Purchase successful",
    "book": "How to get a good grade in DOS in 40 minutes a day",
    "orderId": "1732819200000",
    "price": 30
  }
}
```

#### Health Check
```http
GET /health
```
Check service health and dependencies.

#### Cache Statistics
```http
GET /cache-stats
```
Get cache performance statistics.

#### Invalidate Cache
```http
POST /invalidate-cache
Body: { "key": "info:1" }
```

### API Endpoints Summary

| Method | Endpoint | Description | Cached |
|--------|----------|-------------|--------|
| GET | `/search/:topic` | Search books by topic | ✅ Yes |
| GET | `/info/:id` | Get book details | ✅ Yes |
| POST | `/purchase/:id` | Purchase a book | ❌ No |
| POST | `/invalidate-cache` | Invalidate cache entry | - |
| GET | `/health` | Health check | ❌ No |
| GET | `/cache-stats` | Cache statistics | ❌ No |

### Catalog Service (http://localhost:3001)

#### Search by Topic
```http
GET /search/:topic
```

#### Get Book Details
```http
GET /info/:id
```

#### Update Book
```http
PUT /update/:id
Body: { "price": 25, "stock": 15 }
```
Updates book price or stock, then syncs to replicas.

#### Replica Sync Endpoint
```http
POST /sync-update/:id
```
Internal endpoint for replica synchronization.

#### Health Check
```http
GET /health
```

### Catalog Service Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search/:topic` | Search books by topic |
| GET | `/info/:id` | Get book information |
| PUT | `/update/:id` | Update book (price/stock) |
| POST | `/sync-update/:id` | Replica sync endpoint |
| GET | `/health` | Health check |

### Order Service (http://localhost:3000)

#### Create Purchase Order
```http
POST /purchase/:id
```

#### Get All Orders
```http
GET /orders
```

#### Health Check
```http
GET /health
```

### Order Service Endpoints Summary

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/purchase/:id` | Purchase a book |
| GET | `/orders` | Get all orders |
| GET | `/health` | Health check |

## 🧪 Testing

### Manual Testing

```powershell
# Search for books
Invoke-RestMethod -Uri "http://localhost:3002/search/distributed systems"

# Get book details
Invoke-RestMethod -Uri "http://localhost:3002/info/1"

# Purchase a book
Invoke-RestMethod -Uri "http://localhost:3002/purchase/5" -Method POST

# View orders
Invoke-RestMethod -Uri "http://localhost:3000/orders"

# Check cache stats
Invoke-RestMethod -Uri "http://localhost:3002/cache-stats"

# Health checks
Invoke-RestMethod -Uri "http://localhost:3002/health"
```

### Performance Testing

```powershell
# Run comprehensive performance tests
.\test-performance.ps1

# Results will be saved to docs/performance-results.csv
```

Performance tests measure:
- Response time with and without caching
- Cache hit/miss rates
- Cache invalidation overhead
- Load balancing distribution
- Purchase operation latency

## 📊 Performance Results

| Metric | Without Cache | With Cache | Improvement |
|--------|---------------|------------|-------------|
| Search Requests | 45ms | 8ms | **82%** ↓ |
| Info Requests | 42ms | 6ms | **86%** ↓ |
| Cache Hit Rate | - | 70-75% | - |
| Purchase Latency | 125ms | - | - |
| Invalidation Overhead | - | 47ms | 38% of write |

See [PERFORMANCE.md](docs/PERFORMANCE.md) for detailed analysis.

## 🔧 Configuration

### Environment Variables

**Frontend:**
```bash
PORT=3002
CATALOG_REPLICAS=http://catalog1:3001,http://catalog2:3001
ORDER_REPLICAS=http://order1:3000,http://order2:3000
```

**Catalog:**
```bash
PORT=3001
FRONTEND_URL=http://frontend:3002
REPLICA_URLS=http://catalog2:3001
```

**Order:**
```bash
PORT=3000
CATALOG_SERVICE_URL=http://catalog:3001
FRONTEND_URL=http://frontend:3002
```

### Cache Configuration

Edit `frontend-server/app.js`:
```javascript
const cache = new NodeCache({
  stdTTL: 300,    // Time to live (seconds)
  maxKeys: 100,   // Maximum cache entries
});
```

## 🐳 Docker Configuration

### Docker Services

| Service  | Port | Container Name     | Health Check |
|----------|------|--------------------|--------------|
| Catalog  | 3001 | catalog-service    | ✅           |
| Order    | 3000 | order-service      | ✅           |
| Frontend | 3002 | frontend-service   | ✅           |

### Docker Commands

```bash
# Build and start services
docker-compose up --build

# Start services in background
docker-compose up -d

# Stop services
docker-compose down

# View logs
docker-compose logs -f

# View specific service logs
docker-compose logs -f frontend

# Restart a service
docker-compose restart catalog

# Check service status
docker-compose ps
```

## 📁 Project Structure

```
BAZAR-COM/
├── catalog-server/
│   ├── app.js              # Catalog service implementation
│   ├── catalog.csv         # Book inventory database
│   ├── Dockerfile          # Catalog Docker config
│   └── package.json
├── order-server/
│   ├── app.js              # Order service implementation
│   ├── orders.csv          # Orders database
│   ├── Dockerfile          # Order Docker config
│   ├── package.json
│   └── utils/
│       └── formatDate.js   # Date formatting utility
├── frontend-server/
│   ├── app.js              # Frontend API gateway + Cache + Load Balancer
│   ├── Dockerfile          # Frontend Docker config
│   └── package.json
├── docs/
│   ├── DESIGN.md           # Design document
│   ├── PERFORMANCE.md      # Performance results
│   ├── performance-results.csv
│   └── TEST-OUTPUT.md
├── docker-compose.yml      # Development setup
├── docker-swarm.yml        # Production setup
├── build-images.sh         # Build Docker images
├── deploy-swarm.sh         # Deploy to Swarm
├── scale-services.sh       # Scale replicas
├── test-performance.ps1    # Performance tests
└── README.md               # This file
```

## 🎯 Key Implementation Details

### 1. Load Balancing
- **Algorithm**: Round-Robin
- **Implementation**: Frontend maintains replica indices
- **Distribution**: Even distribution across replicas
- **Failover**: Not implemented (can be added)

```javascript
function getNextCatalogReplica() {
  const replica = CATALOG_REPLICAS[catalogReplicaIndex];
  catalogReplicaIndex = (catalogReplicaIndex + 1) % CATALOG_REPLICAS.length;
  return replica;
}
```

### 2. Caching Strategy
- **Location**: Integrated into Frontend
- **Type**: In-memory (NodeCache)
- **TTL**: 5 minutes
- **Eviction**: LRU policy
- **Scope**: Search and info requests only

### 3. Cache Invalidation
- **Method**: Server-Push (Strong Consistency)
- **Trigger**: Before any database write
- **Flow**: Backend → POST `/invalidate-cache` → Frontend
- **Timing**: Synchronous (blocking)
- **Overhead**: ~47ms per invalidation

### 4. Replica Synchronization
- **Scope**: Catalog service replicas
- **Method**: HTTP POST to `/sync-update/:id`
- **Timing**: After primary write
- **Protocol**: Prevent circular updates with `X-Replica-Sync` header
- **Error Handling**: Non-blocking, logged failures

## 📝 Documentation

- **[Design Document](docs/DESIGN.md)**: Architecture, design decisions, and trade-offs
- **[Performance Results](docs/PERFORMANCE.md)**: Detailed performance measurements and analysis

## 🐛 Troubleshooting

### Services won't start
```bash
# Check Docker is running
docker ps

# View logs
docker-compose logs

# Rebuild from scratch
docker-compose down -v
docker-compose up --build
```

### Services can't connect to each other
- Ensure all services are on the same Docker network
- Check that service names match in environment variables
- Verify health checks are passing

### Port conflicts
- Check if ports 3000, 3001, 3002 are available
- Modify port mappings in `docker-compose.yml` if needed

### Cache not working
```bash
# Check frontend logs
docker-compose logs frontend

# Test cache endpoint
Invoke-RestMethod -Uri "http://localhost:3002/cache-stats"
```

### Replica not syncing
```bash
# Check catalog logs
docker-compose logs catalog

# Verify REPLICA_URLS is set correctly
docker exec catalog-service env | grep REPLICA
```

### CSV file not found
- Ensure CSV files exist in respective service directories
- Check volume mappings in `docker-compose.yml`

## � Data Format

### catalog.csv
```csv
ID,TOPIC,TITLE,PRICE,STOCK
1,distributed systems,How to get a good grade in DOS in 40 minutes a day,30,10
```

### orders.csv
```csv
ORDER_ID,BOOK_ID,TITLE,QUANTITY,TOTAL_PRICE,TIMESTAMP
1732819200000,1,How to get a good grade in DOS in 40 minutes a day,1,30,2024-11-28 10:30:00
```

## �🚧 Known Limitations

1. **CSV File Storage**: Not suitable for production (use PostgreSQL/MongoDB)
2. **No Authentication**: API is publicly accessible
3. **No Request Validation**: Limited input sanitization
4. **Frontend Single Point**: Frontend not replicated
5. **Sync Failures**: Replica sync failures are logged but not retried
6. **No Circuit Breaker**: Failed replicas not automatically bypassed

## 🔮 Future Improvements

- [ ] Replace CSV with proper database (PostgreSQL/MongoDB)
- [ ] Add frontend replication with shared cache (Redis)
- [ ] Implement circuit breaker pattern
- [ ] Add authentication and authorization (JWT)
- [ ] Implement request rate limiting
- [ ] Add distributed tracing (OpenTelemetry)
- [ ] Implement consensus protocol (Raft) for replicas
- [ ] Add monitoring dashboard (Grafana)
- [ ] Implement automated testing (Jest/Mocha)
- [ ] Add CI/CD pipeline (GitHub Actions)
- [ ] Implement API versioning
- [ ] Add request/response compression

## 🔒 Best Practices Implemented

- ✅ Input validation on all endpoints
- ✅ Proper HTTP status codes
- ✅ Structured error responses
- ✅ Request timeout handling
- ✅ Container health checks
- ✅ Graceful shutdown handling
- ✅ Environment-based configuration
- ✅ Service dependency management
- ✅ Request/response logging
- ✅ Proper CORS configuration
- ✅ Retry logic for failed requests

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is created for educational purposes as part of Distributed Operating Systems coursework.

## 👥 Authors

**Nassar Harashi**
- GitHub: [@nassarharashi](https://github.com/nassarharashi)

**Malik T. Ali**
- GitHub: [@MalikTAli](https://github.com/MalikTAli)

## 🙏 Acknowledgments

- Built with Express.js and Node.js
- Containerized with Docker
- CSV processing with csv-parser and csv-writer
- Caching with node-cache
- Part of Distributed Operating Systems coursework

---

**Distributed Operating Systems - Labs 1 & 2**  
**Fall 2024**  
**Topics**: Microservices, Replication, Caching, and Consistency
