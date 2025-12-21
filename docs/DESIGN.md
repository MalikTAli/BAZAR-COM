# Bazar.com - Design Document
## Lab 2: Replication, Caching, and Consistency

### Project Overview
Bazar.com is a distributed online bookstore implementing microservices architecture with three main components:
- **Frontend Service** (Port 3002)
- **Catalog Service** (Port 3001) 
- **Order Service** (Port 3000)

---

## Architecture Design

### 1. System Architecture
```
                    ┌─────────────────────┐
                    │   Client Requests   │
                    └──────────┬──────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │  Frontend Service   │
                    │   (Port 3002)       │
                    │  - Load Balancer    │
                    │  - In-Memory Cache  │
                    └──────────┬──────────┘
                               │
                ┌──────────────┴──────────────┐
                │                             │
                ▼                             ▼
    ┌───────────────────────┐    ┌───────────────────────┐
    │  Catalog Service      │    │   Order Service       │
    │   (Replicas: 2)       │◄───│   (Replicas: 2)       │
    │  - Book Database      │    │  - Order Database     │
    │  - Replica Sync       │    │  - Order Processing   │
    └───────────────────────┘    └───────────────────────┘
```

### 2. Component Details

#### Frontend Service
**Responsibilities:**
- Load balancing across backend replicas
- In-memory caching with NodeCache
- Request routing and validation
- Cache invalidation handling

**Key Features:**
- **Round-Robin Load Balancing**: Distributes requests evenly across catalog and order replicas
- **Cache Management**: 
  - TTL: 5 minutes (300 seconds)
  - Max Keys: 100 items
  - Cache keys: `search:<topic>`, `info:<bookId>`
- **Cache Invalidation**: Receives server-push invalidation from backends

**Load Balancing Algorithm:**
```javascript
// Round-Robin implementation
function getNextCatalogReplica() {
  const replica = CATALOG_REPLICAS[catalogReplicaIndex];
  catalogReplicaIndex = (catalogReplicaIndex + 1) % CATALOG_REPLICAS.length;
  return replica;
}
```

#### Catalog Service
**Responsibilities:**
- Book information management
- Stock tracking
- Search functionality
- Replica synchronization

**Database:** CSV file (`catalog.csv`)

**Books Available:**
1. How to get a good grade in DOS in 40 minutes a day
2. RPCs for Noobs
3. Xen and the Art of Surviving Undergraduate School
4. Cooking for the Impatient Undergrad
5. **How to finish Project 3 on time** (New)
6. **Why theory classes are so hard** (New)
7. **Spring in the Pioneer Valley** (New)

**Replica Synchronization:**
- Updates propagated to all replicas via POST `/sync-update/:id`
- Prevents circular updates using `X-Replica-Sync` header
- Asynchronous synchronization (non-blocking)

#### Order Service
**Responsibilities:**
- Order processing
- Stock validation
- Purchase transactions
- Order history

**Database:** CSV file (`orders.csv`)

---

## Key Features Implementation

### 1. Replication
- **Catalog Service**: 2 replicas configured via Docker Swarm
- **Order Service**: 2 replicas configured via Docker Swarm
- **Frontend Service**: Single instance (non-replicated)

### 2. Caching Strategy

**What is Cached:**
- Book search results (by topic)
- Book information (by ID)

**What is NOT Cached:**
- Purchase requests (write operations)
- Order history
- Health checks

**Cache Invalidation Strategy:**
- **Server-Push**: Backend services send invalidation requests to frontend
- **Timing**: Cache invalidated BEFORE database writes
- **Endpoint**: POST `/invalidate-cache` with `{bookId}`

**Cache Consistency Flow:**
```
1. Client → Purchase Request → Order Service
2. Order Service → Invalidate Cache → Frontend
3. Frontend → Delete cache entry for book
4. Order Service → Update Stock → Catalog Service
5. Catalog Service → Invalidate Cache → Frontend (again)
6. Catalog Service → Update Database
7. Catalog Service → Sync Replicas → Other Catalog Replicas
```

### 3. Consistency Model

**Strong Consistency** is maintained through:
1. **Cache Invalidation Before Write**: Ensures no stale data served
2. **Synchronous Operations**: Write operations are atomic
3. **Replica Synchronization**: All replicas updated after primary write
4. **Transaction Ordering**: 
   - Invalidate cache first
   - Update database second
   - Sync replicas third

---

## API Endpoints

### Frontend Service (Port 3002)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search/:topic` | Search books by topic (cached) |
| GET | `/info/:id` | Get book details (cached) |
| POST | `/purchase/:id` | Purchase book (not cached) |
| POST | `/invalidate-cache` | Invalidate cache entry |
| GET | `/health` | Health check |
| GET | `/cache-stats` | Cache statistics |

### Catalog Service (Port 3001)
| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/search/:topic` | Search books by topic |
| GET | `/info/:id` | Get book information |
| PUT | `/update/:id` | Update book (price/stock) |
| POST | `/sync-update/:id` | Replica sync endpoint |
| GET | `/health` | Health check |

### Order Service (Port 3000)
| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/purchase/:id` | Purchase a book |
| GET | `/orders` | Get all orders |
| GET | `/health` | Health check |

---

## Design Trade-offs

### 1. Cache Location
**Decision:** Integrated into Frontend Service
- **Pros:** 
  - Lower latency (no network calls)
  - Simpler architecture
  - Single point of cache management
- **Cons:** 
  - Cache lost if frontend restarts
  - Cannot scale cache independently

**Alternative:** Separate cache service (e.g., Redis)

### 2. Load Balancing Algorithm
**Decision:** Round-Robin
- **Pros:**
  - Simple implementation
  - Fair distribution
  - No state tracking needed
- **Cons:**
  - Doesn't consider replica load
  - No health-aware routing

**Alternative:** Least-loaded or health-aware load balancing

### 3. Replica Synchronization
**Decision:** Asynchronous propagation
- **Pros:**
  - Fast response time
  - Non-blocking writes
  - Fault tolerant (failures don't block main request)
- **Cons:**
  - Brief inconsistency window
  - Potential sync failures

**Alternative:** Synchronous replication with 2-phase commit

### 4. Cache Invalidation
**Decision:** Server-Push
- **Pros:**
  - Strong consistency
  - Immediate invalidation
  - No stale reads after write
- **Cons:**
  - Coupling between services
  - Additional network calls
  - Invalidation failures logged but not blocking

**Alternative:** TTL-only or polling

---

## Possible Improvements

### 1. Enhanced Caching
- Implement LRU (Least Recently Used) eviction policy
- Add cache warming strategies
- Implement partial cache invalidation for search results
- Add cache hit/miss ratio monitoring

### 2. Load Balancing Enhancements
- Health-aware load balancing (skip unhealthy replicas)
- Least-loaded algorithm with replica monitoring
- Session affinity for per-user load balancing
- Weighted load balancing for heterogeneous replicas

### 3. Replica Synchronization
- Implement consensus protocol (Raft/Paxos)
- Add read-your-writes consistency guarantees
- Implement conflict resolution for concurrent updates
- Add version vectors for causality tracking

### 4. Fault Tolerance
- Circuit breaker pattern for failing replicas
- Automatic retry with exponential backoff
- Request timeout configuration
- Graceful degradation when replicas unavailable

### 5. Monitoring & Observability
- Distributed tracing (e.g., OpenTelemetry)
- Metrics collection (Prometheus)
- Centralized logging (ELK stack)
- Performance dashboards

### 6. Data Persistence
- Replace CSV with proper database (PostgreSQL)
- Add database replication
- Implement backup and recovery
- Add transaction support

### 7. Security
- Add authentication (JWT tokens)
- Implement rate limiting
- Add input validation and sanitization
- HTTPS/TLS encryption

---

## Deployment Instructions

### Using Docker Compose (Development)
```bash
# Build and start services
docker-compose up --build

# Run in background
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

### Using Docker Swarm (Production)
```bash
# Initialize swarm
docker swarm init

# Deploy stack with replicas
docker stack deploy -c docker-swarm.yml bazar

# Scale services
docker service scale bazar_catalog=3
docker service scale bazar_order=3

# Check services
docker service ls

# Remove stack
docker stack rm bazar
```

### Environment Variables
```
# Frontend
PORT=3002
CATALOG_REPLICAS=http://catalog1:3001,http://catalog2:3001
ORDER_REPLICAS=http://order1:3000,http://order2:3000

# Catalog
PORT=3001
FRONTEND_URL=http://frontend:3002
REPLICA_URLS=http://catalog2:3001

# Order
PORT=3000
CATALOG_SERVICE_URL=http://catalog:3001
FRONTEND_URL=http://frontend:3002
```

---

## Testing the System

### Search Books
```bash
curl http://localhost:3002/search/distributed%20systems
```

### Get Book Info
```bash
curl http://localhost:3002/info/5
```

### Purchase Book
```bash
curl -X POST http://localhost:3002/purchase/5
```

### Check Cache Stats
```bash
curl http://localhost:3002/cache-stats
```

### Check Health
```bash
curl http://localhost:3002/health
curl http://localhost:3001/health
curl http://localhost:3000/health
```

---

## Performance Considerations

### Expected Improvements
1. **Cache Hit Rate**: 60-80% for repeated searches
2. **Response Time Reduction**: 50-70% for cached requests
3. **Load Distribution**: Even distribution across replicas
4. **Consistency Overhead**: ~50-100ms for invalidation

### Bottlenecks
1. CSV file I/O operations
2. Network latency between services
3. Cache invalidation overhead
4. Replica synchronization delay

---

## Conclusion

This implementation demonstrates key distributed systems concepts:
- **Replication** for availability and load distribution
- **Caching** for performance optimization
- **Strong consistency** through server-push invalidation
- **Microservices architecture** with clear separation of concerns

The system provides a solid foundation for a scalable online bookstore while maintaining data consistency across replicas and cache.
