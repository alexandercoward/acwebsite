const express = require('express');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3007;

// Serve static files from public directory
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1d',
  etag: true
}));

// Health check
app.get('/health', (req, res) => {
  res.send('OK');
});

// Fallback to index.html for SPA-style routing
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
