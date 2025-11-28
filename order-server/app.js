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
const PORT = process.env.PORT;
const CATALOG_SERVICE_URL = process.env.CATALOG_SERVICE_URL;

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

app.post("/purchase/:id", async (req, res) => {
  const bookId = req.params.id;

  try {
    console.log(`Purchase request for book ID: ${bookId}`);

    // 1. Get book info from catalog service
    const bookInfo = await axios.get(`${CATALOG_SERVICE_URL}/info/${bookId}`);

    // 2. Check if book is in stock
    if (bookInfo.data.quantity <= 0) {
      console.log(`Book ${bookId} out of stock`);
      return res.status(400).json({ message: "Book out of stock" });
    }

    // 3. Decrement stock in catalog service
    await axios.put(`${CATALOG_SERVICE_URL}/update/${bookId}`, {
      stock: bookInfo.data.quantity - 1,
    });

    // 4. Create and save order
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

    res.status(500).json({ message: "Purchase failed" });
  }
});

app.get("/orders", (req, res) => {
  res.json({
    orderCount: orders.length,
    orders: orders,
  });
});

loadOrders()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`🚀 Order server running on port ${PORT}`);
      console.log(`Catalog service: ${CATALOG_SERVICE_URL}`);
    });
  })
  .catch((error) => {
    console.error("Failed to load orders:", error);
  });
