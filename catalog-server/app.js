const express = require("express");
const csv = require("csv-parser");
const fs = require("fs");
const createCsvWriter = require("csv-writer").createObjectCsvWriter;
var cors = require("cors");
const app = express();
app.use(express.json());
app.use(cors());
const PORT = 3001;
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
        resolve();
      })
      .on("error", (error) => reject(error));
  });
}

// Save to CSV
async function saveCatalogData() {
  try {
    await csvWriter.writeRecords(catalogData);
    console.log("CSV file updated");
  } catch (error) {
    console.error("Error saving CSV:", error);
  }
}

// Initialize data before starting server
loadCatalogData().then(() => {
  app.listen(PORT, () => {
    console.log(`Catalog server is running on port ${PORT}`);
  });
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
  res.json(response);
});

app.put("/update/:id", async (req, res) => {
  const id = req.params.id;
  const { price, stock } = req.body; // Changed from 'quantity' to 'stock'

  const item = catalogData.find((item) => item.ID === id);

  if (!item) {
    return res.status(404).json({ error: "Item not found" });
  }

  if (price !== undefined) item.PRICE = price.toString();
  if (stock !== undefined) item.STOCK = stock.toString();

  await saveCatalogData();

  console.log(`Updated book ${id}:`, { price, stock });
  res.json({
    message: "Item updated successfully",
    item: {
      id: item.ID,
      title: item.TITLE,
      stock: item.STOCK,
      price: item.PRICE,
    },
  });
});
