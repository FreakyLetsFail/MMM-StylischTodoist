/*
 * MMM-StylishTodoist - Enhanced Node Helper
 * MIT License
 */
"use strict";

const NodeHelper = require("node_helper");
const moment = require("moment");
const fetch = require("node-fetch");
const express = require("express");
const bodyParser = require("body-parser");
const path = require("path");
const fs = require("fs");
const net = require("net");

// Shared server instance for all modules
let sharedServer = null;

module.exports = NodeHelper.create({
  start: function() {
    console.log(`[${this.name}] Node helper started`);
    
    this.accounts = {};
    this.todoistInstances = {};
    this.settings = {};
    this.cachePath = path.join(__dirname, "cache");
    this.storagePath = path.join(this.path, "accounts");
    this.isInitialized = false;

    // Initialize directories
    this.initializeDirectories();
    
    // Setup shared express server
    this.initializeServer()
      .then(() => {
        // Setup API routes
        this.setupAPIRoutes();
        // Load existing data
        this.loadInitialData();
        this.isInitialized = true;
        console.log(`[${this.name}] Initialization complete`);
      })
      .catch(error => {
        console.error(`[${this.name}] Initialization failed:`, error);
      });
  },

  initializeDirectories: function() {
    [this.storagePath, this.cachePath].forEach(dir => {
      try {
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
          console.log(`[${this.name}] Created directory: ${dir}`);
        }
      } catch (error) {
        console.error(`[${this.name}] Error creating directory ${dir}:`, error);
      }
    });
  },

  initializeServer: function() {
    return new Promise((resolve, reject) => {
      // Use existing shared server if available
      if (sharedServer) {
        this.expressApp = sharedServer.expressApp;
        console.log(`[${this.name}] Using existing shared server on port ${sharedServer.port}`);
        return resolve();
      }

      // Create new express app
      this.expressApp = express();
      this.expressApp.use(bodyParser.json({ limit: '10mb' }));
      this.expressApp.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));

      // Shared static files for all modules
      this.expressApp.use("/MMM-StylishModules", express.static(path.join(this.path, "../public")));
      
      // Module-specific static files
      this.expressApp.use("/MMM-StylishTodoist", express.static(path.join(this.path, "public")));

      // Use fixed port 8200
      const port = 8200;
      
      try {
        this.server = this.expressApp.listen(port, () => {
          console.log(`[${this.name}] Started server on fixed port ${port}`);
          sharedServer = {
            expressApp: this.expressApp,
            port: port
          };
          resolve();
        }).on('error', (err) => {
          if (err.code === 'EADDRINUSE') {
            console.log(`[${this.name}] Port ${port} already in use, will use existing server`);
            // Try to check if port 8200 is used by our Magic Mirror
            this.checkIfServerIsOurs(port)
              .then(isOurs => {
                if (isOurs) {
                  console.log(`[${this.name}] Port ${port} is used by another Magic Mirror module, will use it`);
                  // We'll assume the existing server is compatible with our routes
                  this.useSharedServerWithoutStarting();
                  resolve();
                } else {
                  console.warn(`[${this.name}] Port ${port} is used by an external application`);
                  this.useSharedServerWithoutStarting();
                  resolve();
                }
              })
              .catch(err => {
                console.error(`[${this.name}] Error checking server ownership:`, err);
                this.useSharedServerWithoutStarting();
                resolve();
              });
          } else {
            console.error(`[${this.name}] Server error:`, err);
            this.useSharedServerWithoutStarting();
            resolve();
          }
        });
      } catch (error) {
        console.error(`[${this.name}] Error starting server:`, error);
        this.useSharedServerWithoutStarting();
        resolve();
      }
    });
  },
  
  useSharedServerWithoutStarting: function() {
    // Setup a minimal shared server reference that allows routes to be defined
    // even though we're not actually listening on a port
    sharedServer = {
      expressApp: this.expressApp,
      port: 8200 // We'll pretend we're on 8200 even if we're not actually listening
    };
  },
  
  checkIfServerIsOurs: function(port) {
    return new Promise((resolve) => {
      // Try to fetch a Magic Mirror specific endpoint to confirm it's our server
      const http = require('http');
      const options = {
        hostname: 'localhost',
        port: port,
        path: '/MMM-StylishCalendar/health',
        method: 'GET',
        timeout: 500
      };
      
      const req = http.request(options, (res) => {
        if (res.statusCode === 200) {
          let data = '';
          res.on('data', (chunk) => {
            data += chunk;
          });
          res.on('end', () => {
            try {
              const response = JSON.parse(data);
              // If this is a Magic Mirror module endpoint, it's ours
              resolve(true);
            } catch (e) {
              resolve(false);
            }
          });
        } else {
          resolve(false);
        }
      });
      
      req.on('error', () => {
        resolve(false);
      });
      
      req.end();
    });
  },

  findAvailablePort: function(startPort, endPort) {
    return new Promise((resolve, reject) => {
      const testPort = (port) => {
        if (port > endPort) {
          return reject(new Error(`No available ports between ${startPort}-${endPort}`));
        }

        const tester = net.createServer()
          .once('error', (err) => {
            if (err.code === 'EADDRINUSE') {
              testPort(port + 1);
            } else {
              reject(err);
            }
          })
          .once('listening', () => {
            tester.once('close', () => resolve(port)).close();
          })
          .listen(port);
      };

      testPort(startPort);
    });
  },

  setupAPIRoutes: function() {
    if (!this.expressApp) {
      console.error(`[${this.name}] Cannot setup routes - express app not initialized`);
      return;
    }

    // Always accept 'default' as a valid instance ID
    const handleInstanceParam = (req, res, next) => {
      // If the instance doesn't exist but 'default' is requested, create it
      if (req.params.instanceId === 'default' && !this.todoistInstances['default']) {
        console.log(`[${this.name}] Creating default instance for API request`);
        this.todoistInstances['default'] = {
          config: {
            updateInterval: 10 * 60 * 1000,
            maximumEntries: 30
          },
          lastUpdated: null
        };
      }
      next();
    };

    // Health check endpoint
    this.expressApp.get("/MMM-StylishTodoist/health", (req, res) => {
      console.log(`[${this.name}] Health check requested from ${req.ip}`); 
      res.json({
        status: "OK",
        module: this.name,
        serverPort: sharedServer?.port || 8200,
        serverUrl: `http://localhost:${sharedServer?.port || 8200}/MMM-StylishTodoist/setup`,
        accounts: Object.keys(this.accounts).length,
        instances: Object.keys(this.todoistInstances).length
      });
    });
    
    // Also handle Calendar's health check to make port sharing easier
    this.expressApp.get("/MMM-StylishCalendar/health", (req, res) => {
      res.json({ 
        status: "OK", 
        module: "MMM-StylishCalendar",
        port: "8200" 
      });
    });
    
    // Add test connection endpoint
    this.expressApp.post("/MMM-StylishTodoist/api/test-connection", async (req, res) => {
      try {
        const token = req.body.token;
        if (!token) {
          return res.status(400).json({ success: false, error: "API token is required" });
        }
        
        console.log(`[${this.name}] Testing Todoist API connection from ${req.ip}`);
        const isValid = await this.testTodoistConnection(token);
        console.log(`[${this.name}] Todoist API connection test result: ${isValid ? "success" : "failed"}`);
        
        res.json({ 
          success: true, 
          valid: isValid,
          message: isValid ? "Connection successful" : "Connection failed" 
        });
      } catch (error) {
        console.error(`[${this.name}] Error testing connection:`, error);
        res.status(500).json({ success: false, error: "Failed to test connection" });
      }
    });
    
    // Add account sync endpoint
    this.expressApp.post("/MMM-StylishTodoist/api/sync-account/:instanceId", handleInstanceParam, async (req, res) => {
      try {
        const instanceId = req.params.instanceId;
        const { token } = req.body;
        
        if (!token) {
          return res.status(400).json({ success: false, error: "API token is required" });
        }
        
        console.log(`[${this.name}] Manual sync requested for account from ${req.ip}`);
        
        // Create a minimal account object if it doesn't exist
        if (!this.accounts[token]) {
          this.accounts[token] = {
            token: token,
            name: "Todoist",
            category: "default",
            tasks: [],
            projects: [],
            lastFetched: null
          };
        }
        
        // Fetch data for this specific account
        const account = this.accounts[token];
        
        // Directly fetch data for this account
        try {
          const { tasks, projects } = await this.fetchAccountData(account);
          account.tasks = tasks;
          account.projects = projects;
          account.lastFetched = new Date();
          
          console.log(`[${this.name}] Manual sync completed for ${account.name}, fetched ${tasks.length} tasks`);
          
          // Trigger a refresh for any modules using this account
          Object.keys(this.todoistInstances).forEach(id => {
            this.refreshTasks(id);
          });
          
          res.json({
            success: true,
            message: `Synced ${tasks.length} tasks for ${account.name}`,
            lastUpdated: account.lastFetched
          });
        } catch (error) {
          console.error(`[${this.name}] Error syncing account data:`, error);
          return res.status(500).json({ success: false, error: "Failed to sync account data" });
        }
      } catch (error) {
        console.error(`[${this.name}] Error in sync endpoint:`, error);
        res.status(500).json({ success: false, error: "Internal server error" });
      }
    });
    
    // Add fallback route for display settings
    this.expressApp.get("/MMM-StylishTodoist/api/display/:instanceId", handleInstanceParam, (req, res) => {
      const instanceId = req.params.instanceId;
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      
      try {
        let settings = {};
        if (fs.existsSync(settingsPath)) {
          settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        } else {
          // Default display settings
          settings = {
            maximumEntries: 10,
            showAvatars: true,
            showDividers: true,
            themeColor: "#E84C3D",
            groupBy: "project",
            updateInterval: 600
          };
        }
        
        res.json({ success: true, data: settings });
      } catch (error) {
        console.error(`[${this.name}] Error loading display settings:`, error);
        res.status(500).json({ success: false, error: "Failed to load display settings" });
      }
    });

    // Setup UI
    this.expressApp.get("/MMM-StylishTodoist/setup", (req, res) => {
      console.log(`[${this.name}] Setup page requested from ${req.ip}`);
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });

    // Refresh API
    this.expressApp.post("/MMM-StylishTodoist/api/refresh/:instanceId", handleInstanceParam, (req, res) => {
      const instanceId = req.params.instanceId;
      
      if (!this.todoistInstances[instanceId]) {
        console.error(`[${this.name}] Instance not found: ${instanceId}`);
        return res.status(404).json({ 
          success: false, 
          error: "Instance not found" 
        });
      }
      
      console.log(`[${this.name}] Refresh requested for instance ${instanceId} from ${req.ip}`);
      
      // Trigger a refresh
      this.refreshTasks(instanceId);
      
      res.json({
        success: true,
        message: "Refresh initiated"
      });
    });
    
    // Account API
    this.expressApp.get("/MMM-StylishTodoist/api/accounts/:instanceId", handleInstanceParam, (req, res) => {
      this.handleGetAccounts(req, res);
    });
    
    this.expressApp.post("/MMM-StylishTodoist/api/accounts/:instanceId", 
      handleInstanceParam,
      this.validateAccountData.bind(this),
      this.handleAddAccount.bind(this)
    );

    this.expressApp.put("/MMM-StylishTodoist/api/accounts/:instanceId", 
      handleInstanceParam,
      this.validateAccountData.bind(this),
      this.handleUpdateAccount.bind(this)
    );

    this.expressApp.delete("/MMM-StylishTodoist/api/accounts/:instanceId/:token", 
      handleInstanceParam,
      this.handleDeleteAccount.bind(this)
    );

    // Projects API
    this.expressApp.get("/MMM-StylishTodoist/api/projects/:instanceId", 
      handleInstanceParam,
      this.handleGetProjects.bind(this)
    );

    this.expressApp.post("/MMM-StylishTodoist/api/projects/:instanceId", 
      handleInstanceParam,
      this.handleSaveProjects.bind(this)
    );

    // Settings API
    this.expressApp.get("/MMM-StylishTodoist/api/settings/:instanceId", 
      handleInstanceParam,
      this.handleGetSettings.bind(this)
    );

    this.expressApp.post("/MMM-StylishTodoist/api/settings/:instanceId", 
      handleInstanceParam,
      this.handleSaveSettings.bind(this)
    );

    console.log(`[${this.name}] API routes initialized`);
  },

  validateAccountData: function(req, res, next) {
    if (!req.body.name || !req.body.token) {
      return res.status(400).json({ 
        success: false, 
        error: "Account name and API token are required" 
      });
    }

    // Basic token format validation - be more lenient with token format
    if (req.body.token.length < 20) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid API token format, token should be at least 20 characters" 
      });
    }

    next();
  },

  /* Account Handlers */
  handleGetAccounts: function(req, res) {
    const instanceId = req.params.instanceId;
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    
    try {
      let accounts = [];
      if (fs.existsSync(accountConfigPath)) {
        accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      }
      
      // Add additional account info
      const enrichedAccounts = accounts.map(account => ({
        ...account,
        hasAvatar: this.checkAvatarCache(account.token),
        lastSynced: this.accounts[account.token]?.lastFetched || null
      }));
      
      res.json({ 
        success: true, 
        data: enrichedAccounts 
      });
    } catch (error) {
      console.error(`[${this.name}] Error loading accounts:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to load accounts",
        details: error.message 
      });
    }
  },

  handleAddAccount: async function(req, res) {
    const instanceId = req.params.instanceId;
    const accountData = req.body;
    
    try {
      // Verify Todoist API connection
      const isValid = await this.testTodoistConnection(accountData.token);
      if (!isValid) {
        throw new Error("Failed to connect to Todoist API with provided token");
      }

      const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
      let accounts = [];
      
      if (fs.existsSync(accountConfigPath)) {
        accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      }
      
      // Check for duplicate
      if (accounts.some(acc => acc.token === accountData.token)) {
        throw new Error("Account with this token already exists");
      }
      
      // Add new account
      accounts.push(accountData);
      fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
      
      // Initialize account data
      this.initializeAccount(accountData);
      
      // Fetch avatar
      await this.fetchUserAvatar(accountData.token);
      
      res.json({ 
        success: true,
        message: "Account added successfully"
      });
    } catch (error) {
      console.error(`[${this.name}] Error adding account:`, error);
      res.status(400).json({ 
        success: false, 
        error: error.message || "Failed to add account" 
      });
    }
  },

  handleUpdateAccount: async function(req, res) {
    const instanceId = req.params.instanceId;
    const updatedAccount = req.body;
    
    try {
      const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
      if (!fs.existsSync(accountConfigPath)) {
        throw new Error("No accounts found for this instance");
      }
      
      let accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      const index = accounts.findIndex(acc => acc.token === updatedAccount.token);
      
      if (index === -1) {
        throw new Error("Account not found");
      }
      
      // Verify Todoist API connection if token changed
      if (accounts[index].token !== updatedAccount.token) {
        const isValid = await this.testTodoistConnection(updatedAccount.token);
        if (!isValid) {
          throw new Error("Failed to verify new Todoist API token");
        }
      }
      
      // Update account
      accounts[index] = updatedAccount;
      fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
      
      // Update in memory
      if (this.accounts[updatedAccount.token]) {
        this.accounts[updatedAccount.token] = {
          ...this.accounts[updatedAccount.token],
          name: updatedAccount.name,
          category: updatedAccount.category,
          color: updatedAccount.color
        };
      }
      
      res.json({ 
        success: true,
        message: "Account updated successfully"
      });
    } catch (error) {
      console.error(`[${this.name}] Error updating account:`, error);
      res.status(400).json({ 
        success: false, 
        error: error.message || "Failed to update account" 
      });
    }
  },

  handleDeleteAccount: function(req, res) {
    const instanceId = req.params.instanceId;
    const token = decodeURIComponent(req.params.token);
    
    try {
      const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
      if (!fs.existsSync(accountConfigPath)) {
        throw new Error("No accounts found for this instance");
      }
      
      let accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      const initialCount = accounts.length;
      
      // Filter out the account to delete
      accounts = accounts.filter(acc => acc.token !== token);
      
      if (accounts.length === initialCount) {
        throw new Error("Account not found");
      }
      
      fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
      
      // Clean up
      if (this.accounts[token]) {
        delete this.accounts[token];
      }
      this.removeAvatarCache(token);
      
      res.json({ 
        success: true,
        message: "Account deleted successfully"
      });
    } catch (error) {
      console.error(`[${this.name}] Error deleting account:`, error);
      res.status(400).json({ 
        success: false, 
        error: error.message || "Failed to delete account" 
      });
    }
  },

  /* Project Handlers */
  handleGetProjects: function(req, res) {
    const instanceId = req.params.instanceId;
    
    try {
      const projectsPath = path.join(this.cachePath, "projects.json");
      let projects = [];
      
      if (fs.existsSync(projectsPath)) {
        projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
        console.log(`[${this.name}] Loaded ${projects.length} projects from cache`);
      } else {
        // If no cached projects, fetch from active accounts
        console.log(`[${this.name}] No cached projects, will attempt to fetch from accounts`);
        if (Object.keys(this.accounts).length > 0) {
          this.fetchAllProjects(Object.values(this.accounts))
            .then(projects => {
              fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
              console.log(`[${this.name}] Cached ${projects.length} projects`);
            })
            .catch(error => {
              console.error(`[${this.name}] Error fetching projects:`, error);
            });
        }
      }
      
      res.json({ 
        success: true, 
        data: projects 
      });
    } catch (error) {
      console.error(`[${this.name}] Error getting projects:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to get projects",
        details: error.message 
      });
    }
  },

  handleSaveProjects: function(req, res) {
    const instanceId = req.params.instanceId;
    const { selectedProjects, projectLimits } = req.body;
    
    try {
      const projectsConfigPath = path.join(this.storagePath, `${instanceId}-projects.json`);
      const config = {
        selectedProjects: selectedProjects || [],
        projectLimits: projectLimits || {}
      };
      
      fs.writeFileSync(projectsConfigPath, JSON.stringify(config, null, 2));
      
      // Update instance config if exists
      if (this.todoistInstances[instanceId]) {
        this.todoistInstances[instanceId].config = {
          ...this.todoistInstances[instanceId].config,
          ...config
        };
      }
      
      res.json({ 
        success: true,
        message: "Project settings saved"
      });
    } catch (error) {
      console.error(`[${this.name}] Error saving projects:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to save project settings",
        details: error.message 
      });
    }
  },

  /* Settings Handlers */
  handleGetSettings: function(req, res) {
    const instanceId = req.params.instanceId;
    
    try {
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      let settings = {};
      
      if (fs.existsSync(settingsPath)) {
        settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
      } else {
        // Default settings
        settings = {
          maximumEntries: 10,
          updateInterval: 600,
          showAvatars: true,
          showDividers: true,
          showCompleted: false,
          showOverdue: true,
          groupBy: "project",
          themeColor: "#E84C3D"
        };
      }
      
      res.json({ 
        success: true, 
        data: settings 
      });
    } catch (error) {
      console.error(`[${this.name}] Error loading settings:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to load settings",
        details: error.message 
      });
    }
  },

  handleSaveSettings: function(req, res) {
    const instanceId = req.params.instanceId;
    const settings = req.body;
    
    try {
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      
      // Update instance config if exists
      if (this.todoistInstances[instanceId]) {
        this.todoistInstances[instanceId].config = {
          ...this.todoistInstances[instanceId].config,
          ...settings
        };
      }
      
      res.json({ 
        success: true,
        message: "Settings saved successfully"
      });
    } catch (error) {
      console.error(`[${this.name}] Error saving settings:`, error);
      res.status(500).json({ 
        success: false, 
        error: "Failed to save settings",
        details: error.message 
      });
    }
  },

  /* Core Functions */
  socketNotificationReceived: function(notification, payload) {
    console.log(`[${this.name}] Received notification: ${notification}`, payload);
    
    if (!this.isInitialized) {
      console.log(`[${this.name}] Initializing before processing ${notification}`);
      this.isInitialized = true;
      
      // Setup express app if not already set
      if (!this.expressApp) {
        this.expressApp = express();
        this.expressApp.use(bodyParser.json({ limit: '10mb' }));
        this.expressApp.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
        
        // Module-specific static files
        this.expressApp.use("/MMM-StylishTodoist", express.static(path.join(this.path, "public")));
        
        // Setup API routes
        this.setupAPIRoutes();
      }
      
      // Initialize directories if they don't exist
      this.initializeDirectories();
    }

    switch (notification) {
      case "CONFIG":
        // Log the exact config we received
        console.log(`[${this.name}] Received CONFIG with identifier: ${payload.identifier}`);
        if (payload.config) {
          console.log(`[${this.name}] Config details: apiToken present: ${Boolean(payload.config.apiToken)}, updateInterval: ${payload.config.updateInterval}, groupBy: ${payload.config.groupBy}`);
        }
        
        // Legacy support - map CONFIG to INIT_TODOIST
        this.initTodoist(payload.identifier || "default", payload.config || payload);
        
        // Also immediately fetch tasks after initializing
        setTimeout(() => {
          this.refreshTasks(payload.identifier || "default");
        }, 500);
        break;
        
      case "INIT_TODOIST":
        // Log the exact config we received
        console.log(`[${this.name}] Received INIT_TODOIST with instance ID: ${payload.instanceId || payload.identifier || "default"}`);
        if (payload.config) {
          console.log(`[${this.name}] Config details: apiToken present: ${Boolean(payload.config.apiToken)}, updateInterval: ${payload.config.updateInterval}, groupBy: ${payload.config.groupBy}`);
        }
        
        this.initTodoist(payload.instanceId || payload.identifier || "default", payload.config || payload);
        
        // Also immediately fetch tasks after initializing
        setTimeout(() => {
          this.refreshTasks(payload.instanceId || payload.identifier || "default");
        }, 500);
        break;
        
      case "GET_TODOIST_TASKS":
        this.getTodoistTasks(payload.instanceId || payload.identifier || "default", payload.config || payload);
        break;
        
      case "UPDATE_TASKS":
      case "REFRESH_TASKS":
        const instanceId = payload.instanceId || payload.identifier || "default";
        console.log(`[${this.name}] Refreshing tasks for instance: ${instanceId}`);
        this.refreshTasks(instanceId);
        break;
        
      default:
        console.warn(`[${this.name}] Unknown notification: ${notification}`);
    }
  },

  initTodoist: function(instanceId, config) {
    console.log(`[${this.name}] Initializing instance ${instanceId}`);
    
    this.todoistInstances[instanceId] = {
      config: config,
      lastUpdated: null
    };
    
    // Load data from storage
    this.loadFromStorage(instanceId);
    
    console.log(`[${this.name}] Instance ${instanceId} initialized`);
  },

  loadFromStorage: function(instanceId) {
    if (!this.todoistInstances[instanceId]) return;

    const loaders = [
      { 
        file: `${instanceId}-accounts.json`, 
        key: 'accounts',
        required: false
      },
      { 
        file: `${instanceId}-settings.json`, 
        key: 'config',
        required: false
      },
      { 
        file: `${instanceId}-projects.json`, 
        key: 'config',
        required: false
      }
    ];

    loaders.forEach(loader => {
      const filePath = path.join(this.storagePath, loader.file);
      try {
        if (fs.existsSync(filePath)) {
          const data = JSON.parse(fs.readFileSync(filePath, "utf8"));
          
          if (loader.key === 'config') {
            this.todoistInstances[instanceId].config = {
              ...this.todoistInstances[instanceId].config,
              ...data
            };
          } else {
            this.todoistInstances[instanceId][loader.key] = data;
          }
        }
      } catch (error) {
        console.error(`[${this.name}] Error loading ${loader.file}:`, error);
      }
    });
  },

  getTodoistTasks: function(instanceId, config) {
    if (!this.todoistInstances[instanceId]) {
      console.error(`[${this.name}] Instance ${instanceId} not initialized`);
      this.initTodoist(instanceId, config);
    }

    // Update config from storage
    this.loadFromStorage(instanceId);
    
    const instance = this.todoistInstances[instanceId];
    
    // Check if we actually have any accounts configured
    const accounts = this.getConfiguredAccounts(instanceId);
    
    if (accounts.length === 0) {
      console.warn(`[${this.name}] No accounts configured for ${instanceId}`);
      
      // Check if we have cached tasks to show
      try {
        const cachedTasksPath = path.join(this.cachePath, `${instanceId}-tasks.json`);
        if (fs.existsSync(cachedTasksPath)) {
          const cachedTasks = JSON.parse(fs.readFileSync(cachedTasksPath, "utf8"));
          console.log(`[${this.name}] No accounts configured, but found ${cachedTasks.length} cached tasks`);
          
          // Send cached tasks but also the error
          this.sendSocketNotification("TODOIST_TASKS", { 
            instanceId, 
            tasks: cachedTasks,
            cached: true,
            error: "Using cached data - no accounts configured"
          });
          return;
        }
      } catch (error) {
        console.error(`[${this.name}] Error checking for cached tasks:`, error);
      }
      
      this.sendSocketNotification("TODOIST_TASKS", { 
        instanceId, 
        tasks: [],
        error: "No accounts configured"
      });
      return;
    }
    
    console.log(`[${this.name}] Fetching tasks for ${instanceId} (${accounts.length} accounts)`);
    
    const fetchPromises = accounts.map(accountConfig => {
      const account = this.initializeAccount(accountConfig);
      
      return this.fetchAccountData(account)
        .then(({ tasks, projects }) => {
          account.tasks = tasks;
          account.projects = projects;
          account.lastFetched = new Date();
          return { tasks, projects };
        })
        .catch(error => {
          console.error(`[${this.name}] Error fetching data for ${account.name}:`, error);
          // Return cached account data if available
          return { 
            tasks: account.tasks || [], 
            projects: account.projects || [] 
          };
        });
    });
    
    Promise.all(fetchPromises)
      .then(results => {
        // Extract tasks and projects
        const allTasks = [].concat(...results.map(r => r.tasks));
        const allProjects = [].concat(...results.map(r => r.projects));
        
        // Process tasks according to configuration
        const processedTasks = this.processTasks(allTasks, instance.config);
        
        console.log(`[${this.name}] Sending ${processedTasks.length} tasks and ${allProjects.length} projects to ${instanceId}`);
        
        instance.lastUpdated = new Date();
        
        // Send both TODOIST_TASKS and TASKS_UPDATED for compatibility
        ["TODOIST_TASKS", "TASKS_UPDATED"].forEach(notification => {
          this.sendSocketNotification(notification, {
            instanceId,
            tasks: processedTasks,
            projects: allProjects,
            lastUpdated: instance.lastUpdated
          });
        });
        
        // Cache projects
        if (accounts.length > 0) {
          this.cacheProjects(accounts);
        }
        
        // Cache tasks for offline use
        this.cacheTasks(instanceId, processedTasks);
      })
      .catch(error => {
        console.error(`[${this.name}] Error processing tasks:`, error);
        
        // Check if we have cached tasks to show as fallback
        try {
          const cachedTasksPath = path.join(this.cachePath, `${instanceId}-tasks.json`);
          if (fs.existsSync(cachedTasksPath)) {
            const cachedTasks = JSON.parse(fs.readFileSync(cachedTasksPath, "utf8"));
            console.log(`[${this.name}] Error fetching fresh data, falling back to ${cachedTasks.length} cached tasks`);
            
            // Send cached tasks with the error notice
            this.sendSocketNotification("TODOIST_TASKS", { 
              instanceId, 
              tasks: cachedTasks,
              cached: true,
              error: "Using cached data - " + error.message
            });
            return;
          }
        } catch (cacheError) {
          console.error(`[${this.name}] Error checking for cached tasks:`, cacheError);
        }
        
        // If no cached data available, send the error
        this.sendSocketNotification("TODOIST_ERROR", { 
          instanceId, 
          error: error.message 
        });
      });
  },

  getConfiguredAccounts: function(instanceId) {
    // First try to get accounts from storage
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    if (fs.existsSync(accountConfigPath)) {
      try {
        const accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
        if (Array.isArray(accounts) && accounts.length > 0) {
          console.log(`[${this.name}] Found ${accounts.length} accounts in ${accountConfigPath}`);
          return accounts;
        }
      } catch (error) {
        console.error(`[${this.name}] Error reading accounts file:`, error);
      }
    }
    
    // If no accounts in storage, check the module config
    const instance = this.todoistInstances[instanceId];
    if (instance && instance.config) {
      // Debug the config we received
      console.log(`[${this.name}] Checking config for API token. Config keys: ${Object.keys(instance.config).join(', ')}`);
      
      if (instance.config.apiToken) {
        console.log(`[${this.name}] Using API token from config for ${instanceId}`);
        // Single token in config
        return [{
          token: instance.config.apiToken,
          name: instance.config.accountName || "Todoist",
          category: "default",
          color: instance.config.themeColor || "#E84C3D"
        }];
      } else if (Array.isArray(instance.config.accounts) && instance.config.accounts.length > 0) {
        console.log(`[${this.name}] Using ${instance.config.accounts.length} accounts from config for ${instanceId}`);
        // Multiple accounts in config
        return instance.config.accounts;
      }
    }
    
    console.log(`[${this.name}] No accounts found for ${instanceId} in storage or config`);
    return [];
  },

  refreshTasks: function(instanceId) {
    if (!this.todoistInstances[instanceId]) {
      console.error(`[${this.name}] Cannot refresh - instance ${instanceId} not found`);
      return;
    }
    
    this.getTodoistTasks(instanceId, this.todoistInstances[instanceId].config);
  },

  initializeAccount: function(accountConfig) {
    if (!this.accounts[accountConfig.token]) {
      this.accounts[accountConfig.token] = {
        token: accountConfig.token,
        name: accountConfig.name || "Todoist",
        category: accountConfig.category || "default",
        color: accountConfig.color || "#E84C3D",
        tasks: [],
        projects: [],
        lastFetched: null
      };
    }
    
    return this.accounts[accountConfig.token];
  },

  fetchAccountData: function(account) {
    return Promise.all([
      this.fetchProjects(account),
      this.fetchTasks(account)
    ]).then(([projects, tasks]) => {
      return { projects, tasks };
    });
  },

  fetchProjects: function(account) {
    return fetch("https://api.todoist.com/rest/v2/projects", {
      headers: { 
        Authorization: `Bearer ${account.token}`,
        "Cache-Control": "no-cache"
      }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      return response.json();
    })
    .then(projects => {
      console.log(`[${this.name}] Fetched ${projects.length} projects for ${account.name}`);
      return projects;
    });
  },

  fetchTasks: function(account) {
    return Promise.all([
      fetch("https://api.todoist.com/rest/v2/tasks", {
        headers: { 
          Authorization: `Bearer ${account.token}`,
          "Cache-Control": "no-cache"
        }
      })
      .then(res => {
        if (!res.ok) {
          console.error(`[${this.name}] Error fetching tasks: ${res.status} ${res.statusText}`);
          return [];
        }
        return res.json();
      })
      .catch(error => {
        console.error(`[${this.name}] Network error fetching tasks:`, error);
        return [];
      }),
      
      fetch("https://api.todoist.com/rest/v2/user", {
        headers: { 
          Authorization: `Bearer ${account.token}`,
          "Cache-Control": "no-cache"
        }
      })
      .then(res => {
        if (!res.ok) {
          console.error(`[${this.name}] Error fetching user info: ${res.status} ${res.statusText}`);
          return null;
        }
        return res.json();
      })
      .catch(error => {
        console.error(`[${this.name}] Network error fetching user info:`, error);
        return null;
      })
    ])
    .then(([tasks, userInfo]) => {
      console.log(`[${this.name}] Fetched ${tasks.length} tasks for ${account.name}`);
      
      // Get projects if they're stored in the account object
      const projects = account.projects || [];
      
      return tasks.map(task => {
        const project = projects.find(p => p.id === task.project_id) || {
          name: "Inbox",
          color: "grey"
        };
        
        return {
          ...task,
          accountName: account.name,
          accountColor: account.color,
          projectName: project.name,
          projectColor: project.color,
          avatar: userInfo?.avatar_url,
          responsible: userInfo?.name || "You"
        };
      });
    })
    .catch(error => {
      console.error(`[${this.name}] Error processing task data:`, error);
      return [];
    });
  },

  processTasks: function(tasks, config) {
    // Filter completed tasks if needed
    let filteredTasks = config.showCompleted ? tasks : tasks.filter(task => !task.completed);
    
    // Handle overdue tasks based on config
    if (!config.showOverdue) {
      const now = moment();
      filteredTasks = filteredTasks.filter(task => 
        !task.due || moment(task.due.date).isSameOrAfter(now)
      );
    }
    
    // Separate tasks with due dates
    const dueTasks = filteredTasks.filter(task => task.due);
    const noDueTasks = filteredTasks.filter(task => !task.due);
    
    // Sort due tasks by date (earlier first)
    dueTasks.sort((a, b) => moment(a.due.date).diff(moment(b.due.date)));
    
    // Apply grouping based on config
    switch (config.groupBy) {
      case "project":
        return this.groupTasksByProject(dueTasks, noDueTasks, config);
        
      case "date":
        return this.groupTasksByDate(dueTasks, noDueTasks, config);
        
      default:
        return [...dueTasks, ...noDueTasks].slice(0, config.maximumEntries);
    }
  },

  groupTasksByProject: function(dueTasks, noDueTasks, config) {
    const projectGroups = {};
    const result = [];
    
    // Process due tasks first
    dueTasks.forEach(task => {
      const projectId = task.project_id || "no_project";
      if (!projectGroups[projectId]) {
        projectGroups[projectId] = {
          projectId,
          projectName: task.projectName,
          projectColor: task.projectColor,
          tasks: []
        };
      }
      
      if (projectGroups[projectId].tasks.length < (config.projectLimits?.[projectId] || config.maximumEntries)) {
        projectGroups[projectId].tasks.push(task);
      }
    });
    
    // Process tasks without due dates
    noDueTasks.forEach(task => {
      const projectId = task.project_id || "no_project";
      if (!projectGroups[projectId]) {
        projectGroups[projectId] = {
          projectId,
          projectName: task.projectName,
          projectColor: task.projectColor,
          tasks: []
        };
      }
      
      if (projectGroups[projectId].tasks.length < (config.projectLimits?.[projectId] || config.maximumEntries)) {
        projectGroups[projectId].tasks.push(task);
      }
    });
    
    // Apply project selection if specified
    const selectedProjects = config.selectedProjects || [];
    const shouldFilterProjects = selectedProjects.length > 0;
    
    // Convert to array
    Object.values(projectGroups).forEach(group => {
      if (!shouldFilterProjects || selectedProjects.includes(group.projectId)) {
        if (config.showDividers) {
          result.push({
            isProjectHeader: true,
            ...group
          });
        }
        result.push(...group.tasks.slice(0, config.maximumEntries));
      }
    });
    
    return result.slice(0, config.maximumEntries);
  },

  groupTasksByDate: function(dueTasks, noDueTasks, config) {
    const dateGroups = {};
    const result = [];
    
    // Group by due date
    dueTasks.forEach(task => {
      const dateKey = moment(task.due.date).format("YYYY-MM-DD");
      if (!dateGroups[dateKey]) {
        dateGroups[dateKey] = {
          date: task.due.date,
          tasks: []
        };
      }
      dateGroups[dateKey].tasks.push(task);
    });
    
    // Sort date groups
    const sortedDateGroups = Object.values(dateGroups)
      .sort((a, b) => moment(a.date).diff(moment(b.date)));
    
    // Add to result with date headers
    sortedDateGroups.forEach(group => {
      if (config.showDividers) {
        result.push({
          isDateHeader: true,
          date: group.date,
          formattedDate: moment(group.date).format(config.dateFormat || "DD.MM.YYYY")
        });
      }
      result.push(...group.tasks);
    });
    
    // Add tasks without due dates at the end
    if (noDueTasks.length > 0) {
      if (config.showDividers) {
        result.push({
          isDateHeader: true,
          date: null,
          formattedDate: "No due date"
        });
      }
      result.push(...noDueTasks);
    }
    
    return result.slice(0, config.maximumEntries);
  },

  /* Cache Management */
  cacheProjects: function(accounts) {
    const allProjects = [];
    
    accounts.forEach(account => {
      const accountObj = this.accounts[account.token];
      if (accountObj && accountObj.projects) {
        allProjects.push(...accountObj.projects.map(p => ({
          ...p,
          account: accountObj.name
        })));
      }
    });
    
    if (allProjects.length === 0) {
      console.log(`[${this.name}] No projects to cache`);
      return;
    }
    
    try {
      fs.writeFileSync(
        path.join(this.cachePath, "projects.json"),
        JSON.stringify(allProjects, null, 2)
      );
      console.log(`[${this.name}] Cached ${allProjects.length} projects`);
    } catch (error) {
      console.error(`[${this.name}] Error caching projects:`, error);
    }
  },

  cacheTasks: function(instanceId, tasks) {
    try {
      fs.writeFileSync(
        path.join(this.cachePath, `${instanceId}-tasks.json`),
        JSON.stringify(tasks, null, 2)
      );
      console.log(`[${this.name}] Cached ${tasks.length} tasks for ${instanceId}`);
    } catch (error) {
      console.error(`[${this.name}] Error caching tasks:`, error);
    }
  },

  /* Avatar Handling */
  fetchUserAvatar: function(token) {
    const avatarPath = path.join(this.cachePath, `avatar_${token.substring(0, 8)}.jpg`);
    
    // Skip if already cached
    if (fs.existsSync(avatarPath)) return Promise.resolve();
    
    return fetch("https://api.todoist.com/rest/v2/user", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.ok ? res.json() : null)
    .then(user => {
      if (user?.avatar_url) {
        return fetch(user.avatar_url)
          .then(res => res.buffer())
          .then(buffer => {
            fs.writeFileSync(avatarPath, buffer);
            console.log(`[${this.name}] Cached avatar for ${token.substring(0, 5)}...`);
          });
      }
    })
    .catch(error => {
      console.error(`[${this.name}] Error fetching avatar:`, error);
    });
  },

  checkAvatarCache: function(token) {
    const avatarPath = path.join(this.cachePath, `avatar_${token.substring(0, 8)}.jpg`);
    return fs.existsSync(avatarPath);
  },

  removeAvatarCache: function(token) {
    const avatarPath = path.join(this.cachePath, `avatar_${token.substring(0, 8)}.jpg`);
    if (fs.existsSync(avatarPath)) {
      fs.unlinkSync(avatarPath);
      console.log(`[${this.name}] Removed avatar cache for ${token.substring(0, 5)}...`);
    }
  },

  /* Helper Functions */
  testTodoistConnection: function(token) {
    if (!token) {
      console.warn(`[${this.name}] Cannot test connection - no token provided`);
      return Promise.resolve(false);
    }
    
    console.log(`[${this.name}] Testing Todoist connection for token ${token.substring(0, 5)}...`);
    
    return fetch("https://api.todoist.com/rest/v2/projects", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => {
      console.log(`[${this.name}] Todoist API response status: ${response.status}`);
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      return response.json();
    })
    .then(projects => {
      console.log(`[${this.name}] Todoist API connection successful: ${Array.isArray(projects)} (received ${projects.length} projects)`);
      return Array.isArray(projects);
    })
    .catch(error => {
      console.error(`[${this.name}] Todoist connection test failed:`, error);
      return false;
    });
  },

  fetchAllProjects: function(accounts) {
    if (!accounts || accounts.length === 0) {
      console.warn(`[${this.name}] No accounts provided for fetchAllProjects`);
      return Promise.resolve([]);
    }
    
    console.log(`[${this.name}] Fetching projects for ${accounts.length} accounts`);
    
    return Promise.all(
      accounts.map(account => {
        if (!account.token) {
          console.warn(`[${this.name}] Account without token provided`);
          return Promise.resolve([]);
        }
        
        console.log(`[${this.name}] Fetching projects for ${account.name || "unknown"}`);
        
        return this.fetchProjects({token: account.token, name: account.name})
          .then(projects => {
            console.log(`[${this.name}] Fetched ${projects.length} projects for ${account.name || "unknown"}`);
            return projects.map(p => ({ ...p, account: account.name || "Unknown" }));
          })
          .catch(error => {
            console.error(`[${this.name}] Error fetching projects for ${account.name || "unknown"}:`, error);
            return [];
          });
      })
    ).then(results => {
      const allProjects = [].concat(...results);
      console.log(`[${this.name}] Total projects fetched: ${allProjects.length}`);
      return allProjects;
    });
  },

  loadInitialData: function() {
    console.log(`[${this.name}] Loading initial data from ${this.storagePath}`);
    
    try {
      // Load account files
      const accountFiles = fs.readdirSync(this.storagePath)
        .filter(file => file.endsWith('-accounts.json'));
      
      accountFiles.forEach(file => {
        try {
          const instanceId = file.replace('-accounts.json', '');
          const accountsData = JSON.parse(fs.readFileSync(path.join(this.storagePath, file), "utf8"));
          
          if (Array.isArray(accountsData) && accountsData.length > 0) {
            console.log(`[${this.name}] Loaded ${accountsData.length} accounts from ${file}`);
            
            // Initialize instance if needed
            if (!this.todoistInstances[instanceId]) {
              this.todoistInstances[instanceId] = {
                config: {
                  updateInterval: 10 * 60 * 1000,
                  maximumEntries: 30
                },
                lastUpdated: null
              };
            }
            
            // Initialize accounts
            accountsData.forEach(account => {
              this.initializeAccount(account);
            });
          }
        } catch (err) {
          console.error(`[${this.name}] Error reading ${file}:`, err);
        }
      });
      
      // Check cache
      if (fs.existsSync(path.join(this.cachePath, "projects.json"))) {
        const stats = fs.statSync(path.join(this.cachePath, "projects.json"));
        console.log(`[${this.name}] Found cached projects (last updated: ${stats.mtime})`);
      }
    } catch (e) {
      console.error(`[${this.name}] Error loading initial data:`, e);
    }
  }
});