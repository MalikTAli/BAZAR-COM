const express = require("express");
require("dotenv").config();
const csv = require("csv-parser");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
var cors = require("cors");
const axios = require("axios");
const app = express();
app.use(express.json());
app.use(cors());

// Middleware to add service ID to all responses
app.use((req, res, next) => {
  res.setHeader('X-Service-ID', SERVICE_ID);
  next();
});

const PORT = process.env.PORT || 3001;
const SERVICE_ID = process.env.SERVICE_ID || `catalog-${Date.now()}`;
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3002";
const REPLICA_URLS = process.env.REPLICA_URLS
  ? process.env.REPLICA_URLS.split(",").filter(url => url !== `http://localhost:${PORT}`)
  : [];
let catalogData = [];

// CSV Writer setup
const csvWriter = createCsvWriter({
  path: "catalog.csv",
  header: [
    { id: "ID", title: "ID" },
    { id: "TOPIC", title: "TOPIC" },
    { id: "TITLE", title: "TITLE" },
    { id: "PRICE", title: "PRICE" },
    { id: "STOCK", title: "STOCK" },
  ],
  append: false,
});

// Load CSV data
function loadCatalogData() {
  return new Promise((resolve, reject) => {
    const results = [];
    fs.createReadStream("catalog.csv")
      .pipe(csv())
      .on("data", (data) => results.push(data))
      .on("end", () => {
        catalogData = results;
        console.log("Catalog data loaded:", catalogData.length, "records");
        resolve();
      })
      .on("error", (error) => reject(error));
  });
}

// Save to CSV
async function saveCatalogData() {
  try {
    if (fs.existsSync("catalog.csv")) {
      fs.unlinkSync("catalog.csv");
    }

    const writer = createCsvWriter({
      path: "catalog.csv",
      header: [
        { id: "ID", title: "ID" },
        { id: "TOPIC", title: "TOPIC" },
        { id: "TITLE", title: "TITLE" },
        { id: "PRICE", title: "PRICE" },
        { id: "STOCK", title: "STOCK" },
      ],
      append: false,
    });

    await writer.writeRecords(catalogData);

    console.log(`[${SERVICE_ID}] Catalog saved`);
  } catch (error) {
    console.error(`[${SERVICE_ID}] Error saving catalog:`, error);
  }
}

// Server-push cache invalidation
async function invalidateFrontendCache(bookId) {
  try {
    console.log(`[${SERVICE_ID}] 📤 Sending cache invalidation to frontend for book ${bookId}`);
    await axios.post(`${FRONTEND_URL}/invalidate-cache`, { bookId }, {
      timeout: 2000,
    });
    console.log(`[${SERVICE_ID}] ✅ Cache invalidation sent successfully`);
  } catch (error) {
    console.error(`[${SERVICE_ID}] ⚠️  Failed to invalidate cache:`, error.message);
    // Don't fail the request if cache invalidation fails
  }
}

// Replica synchronization - propagate updates to other replicas
async function syncWithReplicas(bookId, updateData) {
  if (REPLICA_URLS.length === 0) {
    console.log(`[${SERVICE_ID}] No replicas configured for sync`);
    return;
  }

  console.log(`[${SERVICE_ID}] 🔄 Syncing update to ${REPLICA_URLS.length} replica(s)`);
  
  const syncPromises = REPLICA_URLS.map(async (replicaUrl) => {
    try {
      await axios.post(`${replicaUrl}/sync-update/${bookId}`, updateData, {
        timeout: 3000,
        headers: { 'X-Replica-Sync': 'true' }
      });
      console.log(`[${SERVICE_ID}] ✅ Synced to replica: ${replicaUrl}`);
    } catch (error) {
      console.error(`[${SERVICE_ID}] ⚠️  Failed to sync with replica ${replicaUrl}:`, error.message);
    }
  });

  await Promise.allSettled(syncPromises);
}

// Endpoint for receiving sync updates from other replicas
app.post("/sync-update/:id", async (req, res) => {
  // Check if this is a replica sync request
  if (req.headers['x-replica-sync'] !== 'true') {
    return res.status(403).json({ error: "Unauthorized sync request" });
  }

  const id = req.params.id;
  const { price, stock } = req.body;

  console.log(`[${SERVICE_ID}] 📥 Received sync update for book ${id}`);

  const item = catalogData.find((item) => item.ID === id);
  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (price !== undefined) item.PRICE = price.toString();
  if (stock !== undefined) item.STOCK = stock.toString();

  await saveCatalogData();

  console.log(`[${SERVICE_ID}] ✅ Synced book ${id}:`, { price, stock });
  res.json({ message: "Sync successful", serviceId: SERVICE_ID });
});

app.get("/search/:topic", (req, res) => {
  const topic = decodeURIComponent(req.params.topic).toLowerCase();
  const results = catalogData
    .filter((item) => item.TOPIC && item.TOPIC.toLocaleLowerCase() === topic)
    .map((item) => {
      return {
        id: item.ID,
        title: item.TITLE,
      };
    });
  res.status(200).json(results);
});

app.get("/info/:id", (req, res) => {
  const id = req.params.id;
  const item = catalogData.find((item) => item.ID === id);
  if (!item) {
    return res.status(404).json({ message: "Item not found" });
  }
  const response = {
    title: item.TITLE,
    quantity: parseInt(item.STOCK),
    price: parseInt(item.PRICE),
  };
  console.log(`[${SERVICE_ID}] Info for book ${id}`);
  res.json(response);
});

app.put("/update/:id", async (req, res) => {
  const id = req.params.id;
  const { price, stock } = req.body;

  const item = catalogData.find((item) => item.ID === id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  // Invalidate cache BEFORE updating
  await invalidateFrontendCache(id);

  if (price !== undefined) item.PRICE = price.toString();
  if (stock !== undefined) item.STOCK = stock.toString();

  await saveCatalogData();

  // Sync with other replicas (don't sync if this is already a sync request)
  if (req.headers['x-replica-sync'] !== 'true') {
    await syncWithReplicas(id, { price, stock });
  }

  console.log(`Updated book ${id}:`, { price, stock });
  res.json({
    message: "Item updated successfully",
    item: {
      id: item.ID,
      title: item.TITLE,
      stock: item.STOCK,
      price: item.PRICE,
    },
    serviceId: SERVICE_ID,
  });
});

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "catalog",
    serviceId: SERVICE_ID,
    itemCount: catalogData.length,
    port: PORT,
  });
});

// Initialize data before starting server
loadCatalogData()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[${SERVICE_ID}] Catalog service running on port ${PORT}`);
    });
  })
  .catch((error) => {
    console.error(`[${SERVICE_ID}] Failed to load catalogs:`, error);
  });
