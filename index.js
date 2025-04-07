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
   
   // Load data if exists
   try {
     if (fs.existsSync('./data.json')) {
       const data = fs.readFileSync('./data.json', 'utf8');
       items = JSON.parse(data);
       console.log(Loaded ${items.length} items from storage);
     }
   } catch (err) {
     console.error('Error loading data:', err);
   }
   
   // Save data function
   function saveData() {
     fs.writeFileSync('./data.json', JSON.stringify(items), 'utf8');
     console.log(Saved ${items.length} items to storage);
   }
   
   // GET /items - Retrieve all items with optional filtering
   app.get('/items', (req, res) => {
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
     
     res.json(result);
   });
   
   // POST /items - Create a new item
   app.post('/items', (req, res) => {
     const item = req.body;
     
     // Validate required fields
     if (!item.Initial_Type) {
       return res.status(400).json({ error: 'Initial_Type is required' });
     }
     
     // Validate item type
     const validTypes = ['Project', 'Next Action', 'Waiting On', 'Reference', 'Someday Maybe'];
     if (!validTypes.includes(item.Initial_Type)) {
       return res.status(400).json({ error: 'Invalid Initial_Type value' });
     }
     
     // Validate type-specific required fields
     switch (item.Initial_Type) {
       case 'Project':
         if (!item.P_Title) {
           return res.status(400).json({ error: 'P_Title is required for Projects' });
         }
         break;
       case 'Next Action':
         if (!item.NA_Title) {
           return res.status(400).json({ error: 'NA_Title is required for Next Actions' });
         }
         break;
       case 'Waiting On':
         if (!item.W_Title) {
           return res.status(400).json({ error: 'W_Title is required for Waiting On items' });
         }
         break;
       case 'Reference':
         if (!item.R_Title) {
           return res.status(400).json({ error: 'R_Title is required for Reference items' });
         }
         break;
       case 'Someday Maybe':
         if (!item.SM_Title) {
           return res.status(400).json({ error: 'SM_Title is required for Someday Maybe items' });
         }
         break;
     }
     
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
       Prefix_UUID: ${prefix}-${uuid.substring(0, 8)},
       UUID: uuid
     };
     
     // Add item to collection
     items.push(newItem);
     
     // Save data
     saveData();
     
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
             case 'Someday Maybe': prefix = 'SDMB'; break;
             default: prefix = 'OTHR';
           }
           
           // Create new item with UUID
           const newItem = {
             ...gptParams,
             Prefix_UUID: ${prefix}-${uuid.substring(0, 8)},
             UUID: uuid
           };
           
           // Add item to collection
           items.push(newItem);
           
           // Save data
           saveData();
           
           result = { success: true, createdItem: newItem };
         }
       }
     }
     
     // Send response inside HTML (for GPT to parse)
     const htmlResponse = `
       <!DOCTYPE html>
       <html>
       <head><title>GTD API Response</title></head>
       <body>
         <div id="gptResponse">${JSON.stringify(result)}</div>
       </body>
       </html>
     `;
     
     res.send(htmlResponse);
   });
   
   // Start server
   const PORT = process.env.PORT || 3000;
   app.listen(PORT, () => {
     console.log(Server running on port ${PORT});
   });