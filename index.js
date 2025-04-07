const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());
app.use(express.static('public'));

// In-memory storage
let items = [];

// GET /items endpoint
app.get('/items', (req, res) => {
  let result = [...items];
  
  // Apply filters if provided
  if (req.query.Initial_Type) {
    result = result.filter(item => item.Initial_Type === req.query.Initial_Type);
  }
  
  res.json(result);
});

// POST /items endpoint
app.post('/items', (req, res) => {
  const item = req.body;
  items.push(item);
  res.json(item);
});

// Root endpoint
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
