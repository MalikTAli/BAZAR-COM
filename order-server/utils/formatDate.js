function formatTimestamp() {
  const now = new Date();
  return now.toISOString().replace("T", " ").split(".")[0];
}

module.exports = formatTimestamp;
