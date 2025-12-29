const express = require("express");
require("dotenv").config();
const fs = require("fs");
const csv = require("csv-parser");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
const cors = require("cors");
const { default: axios } = require("axios");
const formatTimestamp = require("./utils/formatDate");

const app = express();
app.use(express.json());
app.use(cors());

// Middleware to add service ID to all responses
app.use((req, res, next) => {
  res.setHeader('X-Service-ID', SERVICE_ID);
  next();
});

const PORT = process.env.PORT || 3000;
const SERVICE_ID = process.env.SERVICE_ID || `order-${Date.now()}`;
const CATALOG_REPLICAS = process.env.CATALOG_REPLICAS
  ? process.env.CATALOG_REPLICAS.split(",")
  : ["http://localhost:3001"];
const FRONTEND_URL = process.env.FRONTEND_URL || "http://localhost:3002";

// Round-robin index for catalog replicas
let catalogReplicaIndex = 0;

// Function to get next catalog replica
function getNextCatalogReplica() {
  const replica = CATALOG_REPLICAS[catalogReplicaIndex];
  catalogReplicaIndex = (catalogReplicaIndex + 1) % CATALOG_REPLICAS.length;
  console.log(`[${SERVICE_ID}] 🔄 Using catalog replica: ${replica}`);
  return replica;
}

const fileExists = fs.existsSync("orders.csv");
const csvWriter = createCsvWriter({
  path: "orders.csv",
  header: [
    { id: "orderId", title: "ORDER_ID" },
    { id: "bookId", title: "BOOK_ID" },
    { id: "title", title: "TITLE" },
    { id: "quantity", title: "QUANTITY" },
    { id: "totalPrice", title: "TOTAL_PRICE" },
    { id: "timestamp", title: "TIMESTAMP" },
  ],
  append: fileExists,
});

let orders = [];

// Load existing orders from CSV
function loadOrders() {
  return new Promise((resolve, reject) => {
    const results = [];

    if (!fs.existsSync("orders.csv")) {
      // Create empty file with headers
      csvWriter
        .writeRecords([])
        .then(() => {
          console.log("Created new orders.csv file");
          orders = [];
          resolve();
        })
        .catch(reject);
      return;
    }

    fs.createReadStream("orders.csv")
      .pipe(csv())
      .on("data", (data) => {
        if (Object.values(data).some((val) => val && val !== "")) {
          results.push(data);
        }
      })
      .on("end", () => {
        orders = results;
        console.log(`Loaded ${orders.length} existing orders`);
        resolve();
      })
      .on("error", (error) => reject(error));
  });
}

// Save orders to CSV
async function saveOrders(order) {
  try {
    const writer = createCsvWriter({
      path: "orders.csv",
      header: [
        { id: "ORDER_ID", title: "ORDER_ID" },
        { id: "BOOK_ID", title: "BOOK_ID" },
        { id: "TITLE", title: "TITLE" },
        { id: "QUANTITY", title: "QUANTITY" },
        { id: "TOTAL_PRICE", title: "TOTAL_PRICE" },
        { id: "TIMESTAMP", title: "TIMESTAMP" },
      ],
      append: true,
    });

    await writer.writeRecords([order]);
    console.log(`Saved order ${order.ORDER_ID} to CSV`);
  } catch (error) {
    console.error("Error saving order:", error);
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

app.post("/purchase/:id", async (req, res) => {
  const bookId = req.params.id;

  try {
    console.log(`[${SERVICE_ID}] Purchase request for book ${bookId}`);

    // 1. Get book info from catalog service (using load balancing)
    const catalogUrl = getNextCatalogReplica();
    const bookInfo = await axios.get(`${catalogUrl}/info/${bookId}`);

    // 2. Check if book is in stock
    if (bookInfo.data.quantity <= 0) {
      console.log(`[${SERVICE_ID}] Book ${bookId} out of stock`);
      return res.status(400).json({ message: "Book out of stock" });
    }

    // 3. Invalidate cache BEFORE updating stock
    await invalidateFrontendCache(bookId);

    // 4. Decrement stock in catalog service
    await axios.put(`${catalogUrl}/update/${bookId}`, {
      stock: bookInfo.data.quantity - 1,
    });

    // 5. Create and save order
    const newOrder = {
      ORDER_ID: Date.now().toString(),
      BOOK_ID: bookId,
      TITLE: bookInfo.data.title,
      QUANTITY: 1,
      TOTAL_PRICE: bookInfo.data.price,
      TIMESTAMP: formatTimestamp(),
    };

    orders.push(newOrder);
    await saveOrders(newOrder);

    res.status(201).json({
      message: "Purchase successful",
      book: bookInfo.data.title,
      orderId: newOrder.ORDER_ID,
      price: bookInfo.data.price,
    });
  } catch (error) {
    if (error.response?.status === 404) {
      return res.status(404).json({ message: "Book not found" });
    }
    console.error(`[${SERVICE_ID}] Purchase failed:`, error.message);
    res.status(500).json({ message: "Purchase failed" });
  }
});

app.get("/orders", (req, res) => {
  res.json({
    orderCount: orders.length,
    orders: orders,
  });
});

// Health endpoint
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    service: "order",
    serviceId: SERVICE_ID,
    port: PORT,
    catalogReplicas: CATALOG_REPLICAS,
    loadBalancing: "Round-Robin",
  });
});

loadOrders()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`[${SERVICE_ID}] 🚀 Order server running on port ${PORT}`);
      console.log(`[${SERVICE_ID}] 📚 Catalog replicas: ${CATALOG_REPLICAS.join(", ")}`);
    });
  })
  .catch((error) => {
    console.error(`[${SERVICE_ID}] Failed to load orders:`, error);
  });
