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

    // Health check endpoint
    this.expressApp.get("/MMM-StylishTodoist/health", (req, res) => {
      res.json({
        status: "OK",
        module: this.name,
        serverPort: sharedServer?.port || 8200,
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
        
        const isValid = await this.testTodoistConnection(token);
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
    
    // Add fallback route for display settings
    this.expressApp.get("/MMM-StylishTodoist/api/display/:instanceId", (req, res) => {
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
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });

    // Account API
    this.expressApp.get("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
      this.handleGetAccounts(req, res);
    });
    
    this.expressApp.post("/MMM-StylishTodoist/api/accounts/:instanceId", 
      this.validateAccountData.bind(this),
      this.handleAddAccount.bind(this)
    );

    this.expressApp.put("/MMM-StylishTodoist/api/accounts/:instanceId", 
      this.validateAccountData.bind(this),
      this.handleUpdateAccount.bind(this)
    );

    this.expressApp.delete("/MMM-StylishTodoist/api/accounts/:instanceId/:token", 
      this.handleDeleteAccount.bind(this)
    );

    // Projects API
    this.expressApp.get("/MMM-StylishTodoist/api/projects/:instanceId", 
      this.handleGetProjects.bind(this)
    );

    this.expressApp.post("/MMM-StylishTodoist/api/projects/:instanceId", 
      this.handleSaveProjects.bind(this)
    );

    // Settings API
    this.expressApp.get("/MMM-StylishTodoist/api/settings/:instanceId", 
      this.handleGetSettings.bind(this)
    );

    this.expressApp.post("/MMM-StylishTodoist/api/settings/:instanceId", 
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

    // Basic token format validation
    if (!/^[a-zA-Z0-9]{40}$/.test(req.body.token)) {
      return res.status(400).json({ 
        success: false, 
        error: "Invalid API token format" 
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
      } else {
        // If no cached projects, fetch from active accounts
        const instance = this.todoistInstances[instanceId];
        if (instance && instance.config.accounts) {
          projects = this.fetchAllProjects(instance.config.accounts)
            .then(projects => {
              fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
              return projects;
            })
            .catch(() => []);
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
    if (!this.isInitialized) {
      console.warn(`[${this.name}] Received notification before initialization: ${notification}`);
      return;
    }

    switch (notification) {
      case "INIT_TODOIST":
        this.initTodoist(payload.instanceId, payload.config);
        break;
        
      case "GET_TODOIST_TASKS":
        this.getTodoistTasks(payload.instanceId, payload.config);
        break;
        
      case "REFRESH_TASKS":
        this.refreshTasks(payload.instanceId);
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
      return;
    }

    // Update config from storage
    this.loadFromStorage(instanceId);
    
    const instance = this.todoistInstances[instanceId];
    
    if (!instance.config.accounts || instance.config.accounts.length === 0) {
      console.warn(`[${this.name}] No accounts configured for ${instanceId}`);
      this.sendSocketNotification("TODOIST_TASKS", { 
        instanceId, 
        tasks: [],
        error: "No accounts configured"
      });
      return;
    }
    
    console.log(`[${this.name}] Fetching tasks for ${instanceId}`);
    
    const fetchPromises = instance.config.accounts.map(accountConfig => {
      const account = this.initializeAccount(accountConfig);
      
      return this.fetchAccountData(account)
        .then(({ tasks, projects }) => {
          account.tasks = tasks;
          account.projects = projects;
          account.lastFetched = new Date();
          return tasks;
        })
        .catch(error => {
          console.error(`[${this.name}] Error fetching data for ${account.name}:`, error);
          return account.tasks || []; // Return cached tasks if available
        });
    });
    
    Promise.all(fetchPromises)
      .then(results => {
        const allTasks = [].concat(...results);
        const processedTasks = this.processTasks(allTasks, instance.config);
        
        console.log(`[${this.name}] Sending ${processedTasks.length} tasks to ${instanceId}`);
        
        instance.lastUpdated = new Date();
        this.sendSocketNotification("TODOIST_TASKS", {
          instanceId,
          tasks: processedTasks,
          lastUpdated: instance.lastUpdated
        });
        
        // Cache projects
        this.cacheProjects(instance.config.accounts);
        
        // Cache tasks for offline use
        this.cacheTasks(instanceId, processedTasks);
      })
      .catch(error => {
        console.error(`[${this.name}] Error processing tasks:`, error);
        this.sendSocketNotification("TODOIST_ERROR", { 
          instanceId, 
          error: error.message 
        });
      });
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
      }).then(res => res.ok ? res.json() : []),
      
      fetch("https://api.todoist.com/rest/v2/user", {
        headers: { 
          Authorization: `Bearer ${account.token}`,
          "Cache-Control": "no-cache"
        }
      }).then(res => res.ok ? res.json() : null)
    ])
    .then(([tasks, userInfo]) => {
      console.log(`[${this.name}] Fetched ${tasks.length} tasks for ${account.name}`);
      
      return tasks.map(task => {
        const project = account.projects.find(p => p.id === task.project_id) || {
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
      if (account.projects) {
        allProjects.push(...account.projects.map(p => ({
          ...p,
          account: account.name
        })));
      }
    });
    
    try {
      fs.writeFileSync(
        path.join(this.cachePath, "projects.json"),
        JSON.stringify(allProjects, null, 2)
      );
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
    }
  },

  /* Helper Functions */
  testTodoistConnection: function(token) {
    return fetch("https://api.todoist.com/rest/v2/projects", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(response => {
      if (!response.ok) {
        throw new Error(`API returned status ${response.status}`);
      }
      return response.json();
    })
    .then(projects => {
      return Array.isArray(projects);
    })
    .catch(error => {
      console.error(`[${this.name}] Todoist connection test failed:`, error);
      return false;
    });
  },

  fetchAllProjects: function(accounts) {
    return Promise.all(
      accounts.map(account => 
        this.fetchProjects(account)
          .then(projects => projects.map(p => ({ ...p, account: account.name })))
          .catch(() => [])
      )
    ).then(results => [].concat(...results));
  },

  loadInitialData: function() {
    console.log(`[${this.name}] Loading initial data from ${this.storagePath}`);
    
    try {
      // Load account files
      const accountFiles = fs.readdirSync(this.storagePath)
        .filter(file => file.endsWith('-accounts.json'));
      
      accountFiles.forEach(file => {
        try {
          const data = JSON.parse(fs.readFileSync(path.join(this.storagePath, file), "utf8"));
          console.log(`[${this.name}] Loaded ${data.length} accounts from ${file}`);
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