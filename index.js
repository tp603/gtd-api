const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');

const app = express();

// Middleware
app.use(bodyParser.json());
app.use(cors());

// Serve static files
app.use(express.static(path.join(__dirname, 'public')));

// In-memory storage (will replace with database later)
let items = [];

// Add request logging middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  if (req.method === 'POST') {
    console.log('Request body:', JSON.stringify(req.body));
  }
  next();
});

// Load data if exists - DISABLED FOR RAILWAY
try {
  console.log('Using in-memory storage only');
} catch (err) {
  console.error('Error:', err);
}

// Save data function - DISABLED FOR RAILWAY
function saveData() {
  console.log(`Items saved in memory only: ${items.length} items`);
}

// GET /items - Retrieve all items with optional filtering
app.get('/items', (req, res) => {
  console.log('GET /items query:', req.query);
  let result = [...items];
  
  // Apply filters if provided
  if (req.query.Initial_Type) {
    result = result.filter(item => item.Initial_Type === req.query.Initial_Type);
  }
  
  if (req.query.Status) {
    result = result.filter(item => {
      const statusField = `${item.Initial_Type === 'Project' ? 'P' : 
                         item.Initial_Type === 'Next Action' ? 'NA' : 
                         item.Initial_Type === 'Waiting On' ? 'W' : 
                         item.Initial_Type === 'Reference' ? 'R' : 'SM'}_Status`;
      return item[statusField] === req.query.Status;
    });
  }
  
  console.log(`Returning ${result.length} items`);
  res.json(result);
});

// POST /items - Create a new item
app.post('/items', (req, res) => {
  console.log('POST /items - Creating new item');
  const item = req.body;
  
  // Validate required fields
  if (!item.Initial_Type) {
    console.log('Error: Missing Initial_Type');
    return res.status(400).json({ error: 'Initial_Type is required' });
  }
  
  // Validate item type
  const validTypes = ['Project', 'Next Action', 'Waiting On', 'Reference', 'Someday Maybe'];
  if (!validTypes.includes(item.Initial_Type)) {
    console.log(`Error: Invalid Initial_Type: ${item.Initial_Type}`);
    return res.status(400).json({ error: 'Invalid Initial_Type value' });
  }
  
  console.log(`Creating item of type: ${item.Initial_Type}`);
  
  // Generate UUID and Prefix
  const uuid = uuidv4();
  let prefix = '';
  switch(item.Initial_Type) {
    case 'Project': prefix = 'PROJ'; break;
    case 'Next Action': prefix = 'NACT'; break;
    case 'Waiting On': prefix = 'WAIT'; break;
    case 'Reference': prefix = 'REF'; break;
    case 'Someday Maybe': prefix = 'SDMB'; break;
    default: prefix = 'OTHR';
  }
  
  // Create new item with UUID
  const newItem = {
    ...item,
    Prefix_UUID: `${prefix}-${uuid.substring(0, 8)}`,
    UUID: uuid
  };
  
  // Log the item we're about to create
  console.log('Creating item:', JSON.stringify(newItem));
  
  // Add item to collection
  items.push(newItem);
  
  // Save data
  saveData();
  
  // Success response
  console.log('Item created successfully');
  res.json(newItem);
});

// Serve HTML interface
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Handle API calls from GPTs via URL parameters
app.get('/gpt', (req, res) => {
  const gptAction = req.query.gptAction;
  const gptParams = req.query.gptParams ? JSON.parse(req.query.gptParams) : {};
  
  let result = { success: false, error: 'Unknown action' };
  
  if (gptAction === 'getItems') {
    let filteredItems = [...items];
    
    if (gptParams.Initial_Type) {
      filteredItems = filteredItems.filter(item => item.Initial_Type === gptParams.Initial_Type);
    }
    
    if (gptParams.Status) {
      filteredItems = filteredItems.filter(item => {
        const statusField = `${item.Initial_Type === 'Project' ? 'P' : 
                           item.Initial_Type === 'Next Action' ? 'NA' : 
                           item.Initial_Type === 'Waiting On' ? 'W' : 
                           item.Initial_Type === 'Reference' ? 'R' : 'SM'}_Status`;
        return item[statusField] === gptParams.Status;
      });
    }
    
    result = { success: true, items: filteredItems };
  } 
  else if (gptAction === 'createItem') {
    // Validate required fields
    if (!gptParams.Initial_Type) {
      result = { success: false, error: 'Initial_Type is required' };
    } else {
      // Validate type-specific required fields
      let isValid = true;
      let errorMessage = '';
      
      switch (gptParams.Initial_Type) {
        case 'Project':
          if (!gptParams.P_Title) {
            isValid = false;
            errorMessage = 'P_Title is required for Projects';
          }
          break;
        case 'Next Action':
          if (!gptParams.NA_Title) {
            isValid = false;
            errorMessage = 'NA_Title is required for Next Actions';
          }
          break;
        case 'Waiting On':
          if (!gptParams.W_Title) {
            isValid = false;
            errorMessage = 'W_Title is required for Waiting On items';
          }
          break;
        case 'Reference':
          if (!gptParams.R_Title) {
            isValid = false;
            errorMessage = 'R_Title is required for Reference items';
          }
          break;
        case 'Someday Maybe':
          if (!gptParams.SM_Title) {
            isValid = false;
            errorMessage = 'SM_Title is required for Someday Maybe items';
          }
          break;
        default:
          isValid = false;
          errorMessage = 'Invalid Initial_Type value';
      }
      
      if (!isValid) {
        result = { success: false, error: errorMessage };
      } else {
        // Generate UUID and Prefix
        const uuid = uuidv4();
        let prefix = '';
        switch(gptParams.Initial_Type) {
          case 'Project': prefix = 'PROJ'; break;
          case 'Next Action': prefix = 'NACT'; break;
          case 'Waiting On': prefix = 'WAIT'; break;
          case 'Reference': prefix = 'REF'; break;
          case 'Someday Maybe': prefix = 'SDMB';
