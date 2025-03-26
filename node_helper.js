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

module.exports = NodeHelper.create({
  start: function() {
    console.log(`[${this.name}] Node helper started`);
    
    this.accounts = {};
    this.todoistInstances = {};
    this.settings = {};
    this.cachePath = path.join(__dirname, "cache");
    this.storagePath = path.join(this.path, "accounts");
    
    // Initialize directories
    this.initializeDirectories();
    
    // Setup express server
    this.initializeServer();
    
    // Setup API routes
    this.setupAPIRoutes();
    
    // Load existing data
    this.loadInitialData();
  },

  initializeDirectories: function() {
    // Create storage paths if they don't exist
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
    this.expressApp = express();
    this.expressApp.use(bodyParser.json({ limit: '10mb' }));
    this.expressApp.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
    this.expressApp.use("/MMM-StylishTodoist", express.static(path.join(this.path, "public")));
    
    try {
      this.server = this.expressApp.listen(8200, () => {
        console.log(`[${this.name}] Setup server running at http://localhost:8200/MMM-StylishTodoist/setup`);
      });
      
      this.server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          console.error(`[${this.name}] Port 8200 in use! Trying alternative port...`);
          this.server = this.expressApp.listen(0, () => {
            console.log(`[${this.name}] Setup server running on alternative port: ${this.server.address().port}`);
          });
        } else {
          console.error(`[${this.name}] Server error:`, e);
        }
      });
    } catch (error) {
      console.error(`[${this.name}] Failed to start server:`, error);
    }
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
  },

  setupAPIRoutes: function() {
    // Setup UI route
    this.expressApp.get("/MMM-StylishTodoist/setup", (req, res) => {
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });

    // Account management endpoints
    this.setupAccountRoutes();
    
    // Project management endpoints
    this.setupProjectRoutes();
    
    // Settings endpoints
    this.setupSettingsRoutes();
    
    // Data endpoints
    this.setupDataRoutes();
  },

  setupAccountRoutes: function() {
    // Get accounts for instance
    this.expressApp.get("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
      this.handleGetAccounts(req, res);
    });
    
    // Add new account
    this.expressApp.post("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
      this.handleAddAccount(req, res);
    });
    
    // Update account
    this.expressApp.put("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
      this.handleUpdateAccount(req, res);
    });
    
    // Delete account
    this.expressApp.delete("/MMM-StylishTodoist/api/accounts/:instanceId/:token", (req, res) => {
      this.handleDeleteAccount(req, res);
    });
  },

  setupProjectRoutes: function() {
    // Get available projects
    this.expressApp.get("/MMM-StylishTodoist/api/projects/:instanceId", (req, res) => {
      this.handleGetProjects(req, res);
    });
    
    // Save project selection
    this.expressApp.post("/MMM-StylishTodoist/api/projects/:instanceId", (req, res) => {
      this.handleSaveProjects(req, res);
    });
    
    // Get project limits
    this.expressApp.get("/MMM-StylishTodoist/api/projects/:instanceId/limits", (req, res) => {
      this.handleGetProjectLimits(req, res);
    });
  },

  setupSettingsRoutes: function() {
    // Get settings
    this.expressApp.get("/MMM-StylishTodoist/api/settings/:instanceId", (req, res) => {
      this.handleGetSettings(req, res);
    });
    
    // Save settings
    this.expressApp.post("/MMM-StylishTodoist/api/settings/:instanceId", (req, res) => {
      this.handleSaveSettings(req, res);
    });
    
    // Get display settings
    this.expressApp.get("/MMM-StylishTodoist/api/display/:instanceId", (req, res) => {
      this.handleGetDisplaySettings(req, res);
    });
  },

  setupDataRoutes: function() {
    // Refresh data
    this.expressApp.post("/MMM-StylishTodoist/api/refresh/:instanceId", (req, res) => {
      this.handleRefreshData(req, res);
    });
    
    // Export data
    this.expressApp.get("/MMM-StylishTodoist/api/export/:instanceId", (req, res) => {
      this.handleExportData(req, res);
    });
    
    // Import data
    this.expressApp.post("/MMM-StylishTodoist/api/import/:instanceId", (req, res) => {
      this.handleImportData(req, res);
    });
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
      
      // Add avatar information if available
      accounts = accounts.map(account => ({
        ...account,
        hasAvatar: this.checkAvatarCache(account.token)
      }));
      
      res.json({ success: true, accounts });
    } catch (error) {
      console.error(`[${this.name}] Error loading accounts:`, error);
      res.status(500).json({ success: false, error: "Failed to load accounts" });
    }
  },

  handleAddAccount: function(req, res) {
    const instanceId = req.params.instanceId;
    const accountConfig = req.body;
    
    if (!accountConfig.name || !accountConfig.token) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    
    try {
      let accounts = [];
      if (fs.existsSync(accountConfigPath)) {
        accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      }
      
      // Check for duplicate
      if (accounts.some(acc => acc.token === accountConfig.token)) {
        return res.status(409).json({ success: false, error: "Account already exists" });
      }
      
      // Add new account
      accounts.push(accountConfig);
      fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
      
      // Fetch avatar immediately
      this.fetchUserAvatar(accountConfig.token);
      
      // Update all instances
      this.updateAllInstances(instanceId, { accounts });
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[${this.name}] Error saving account:`, error);
      res.status(500).json({ success: false, error: "Failed to save account" });
    }
  },

  handleUpdateAccount: function(req, res) {
    const instanceId = req.params.instanceId;
    const updatedAccount = req.body;
    
    if (!updatedAccount.name || !updatedAccount.token) {
      return res.status(400).json({ success: false, error: "Missing required fields" });
    }
    
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    
    try {
      if (!fs.existsSync(accountConfigPath)) {
        return res.status(404).json({ success: false, error: "No accounts found" });
      }
      
      let accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      const index = accounts.findIndex(acc => acc.token === updatedAccount.token);
      
      if (index === -1) {
        return res.status(404).json({ success: false, error: "Account not found" });
      }
      
      // Update account
      accounts[index] = updatedAccount;
      fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
      
      // Update avatar if changed
      this.fetchUserAvatar(updatedAccount.token);
      
      // Update all instances
      this.updateAllInstances(instanceId, { accounts });
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[${this.name}] Error updating account:`, error);
      res.status(500).json({ success: false, error: "Failed to update account" });
    }
  },

  handleDeleteAccount: function(req, res) {
    const instanceId = req.params.instanceId;
    const token = decodeURIComponent(req.params.token);
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    
    try {
      if (!fs.existsSync(accountConfigPath)) {
        return res.status(404).json({ success: false, error: "No accounts found" });
      }
      
      let accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
      const newAccounts = accounts.filter(acc => acc.token !== token);
      
      if (newAccounts.length === accounts.length) {
        return res.status(404).json({ success: false, error: "Account not found" });
      }
      
      fs.writeFileSync(accountConfigPath, JSON.stringify(newAccounts, null, 2));
      
      // Remove cached avatar
      this.removeAvatarCache(token);
      
      // Update all instances
      this.updateAllInstances(instanceId, { accounts: newAccounts });
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[${this.name}] Error deleting account:`, error);
      res.status(500).json({ success: false, error: "Failed to delete account" });
    }
  },

  /* Project Handlers */
  handleGetProjects: function(req, res) {
    const instanceId = req.params.instanceId;
    const instance = this.todoistInstances[instanceId];
    
    if (!instance) {
      return res.status(404).json({ success: false, error: "Instance not found" });
    }
    
    try {
      const projectsPath = path.join(this.cachePath, "projects.json");
      let projects = [];
      
      if (fs.existsSync(projectsPath)) {
        projects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
      } else {
        // Fetch projects if not cached
        projects = this.fetchAllProjects(instance.config.accounts);
        fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
      }
      
      res.json({ success: true, projects });
    } catch (error) {
      console.error(`[${this.name}] Error getting projects:`, error);
      res.status(500).json({ success: false, error: "Failed to get projects" });
    }
  },

  handleSaveProjects: function(req, res) {
    const instanceId = req.params.instanceId;
    const { selectedProjects, projectLimits } = req.body;
    
    const projectsConfigPath = path.join(this.storagePath, `${instanceId}-projects.json`);
    
    try {
      const config = {
        selectedProjects: selectedProjects || [],
        projectLimits: projectLimits || {}
      };
      
      fs.writeFileSync(projectsConfigPath, JSON.stringify(config, null, 2));
      
      // Update instance
      if (this.todoistInstances[instanceId]) {
        this.todoistInstances[instanceId].config = {
          ...this.todoistInstances[instanceId].config,
          ...config
        };
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[${this.name}] Error saving projects:`, error);
      res.status(500).json({ success: false, error: "Failed to save projects" });
    }
  },

  handleGetProjectLimits: function(req, res) {
    const instanceId = req.params.instanceId;
    const projectsConfigPath = path.join(this.storagePath, `${instanceId}-projects.json`);
    
    try {
      if (fs.existsSync(projectsConfigPath)) {
        const config = JSON.parse(fs.readFileSync(projectsConfigPath, "utf8"));
        res.json({ success: true, projectLimits: config.projectLimits || {} });
      } else {
        res.json({ success: true, projectLimits: {} });
      }
    } catch (error) {
      console.error(`[${this.name}] Error getting project limits:`, error);
      res.status(500).json({ success: false, error: "Failed to get project limits" });
    }
  },

  /* Settings Handlers */
  handleGetSettings: function(req, res) {
    const instanceId = req.params.instanceId;
    const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
    
    try {
      if (fs.existsSync(settingsPath)) {
        const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        res.json({ success: true, settings });
      } else {
        // Default settings
        const defaultSettings = {
          maximumEntries: 10,
          updateInterval: 600,
          showAvatars: true,
          showDividers: true
        };
        res.json({ success: true, settings: defaultSettings });
      }
    } catch (error) {
      console.error(`[${this.name}] Error loading settings:`, error);
      res.status(500).json({ success: false, error: "Failed to load settings" });
    }
  },

  handleSaveSettings: function(req, res) {
    const instanceId = req.params.instanceId;
    const settings = req.body;
    const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
    
    try {
      fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      
      // Update instance
      if (this.todoistInstances[instanceId]) {
        this.todoistInstances[instanceId].config = {
          ...this.todoistInstances[instanceId].config,
          ...settings
        };
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[${this.name}] Error saving settings:`, error);
      res.status(500).json({ success: false, error: "Failed to save settings" });
    }
  },

  handleGetDisplaySettings: function(req, res) {
    const instanceId = req.params.instanceId;
    const displayPath = path.join(this.storagePath, `${instanceId}-display.json`);
    
    try {
      if (fs.existsSync(displayPath)) {
        const display = JSON.parse(fs.readFileSync(displayPath, "utf8"));
        res.json({ success: true, display });
      } else {
        // Default display settings
        const defaultDisplay = {
          themeColor: "#E84C3D",
          dateFormat: "DD.MM.YYYY",
          groupBy: "project",
          dueTasksLimit: 5
        };
        res.json({ success: true, display: defaultDisplay });
      }
    } catch (error) {
      console.error(`[${this.name}] Error loading display settings:`, error);
      res.status(500).json({ success: false, error: "Failed to load display settings" });
    }
  },

  /* Data Handlers */
  handleRefreshData: function(req, res) {
    const instanceId = req.params.instanceId;
    
    try {
      this.getTodoistTasks(instanceId, this.todoistInstances[instanceId]?.config || {});
      res.json({ success: true, message: "Refresh initiated" });
    } catch (error) {
      console.error(`[${this.name}] Error refreshing data:`, error);
      res.status(500).json({ success: false, error: "Failed to refresh data" });
    }
  },

  handleExportData: function(req, res) {
    const instanceId = req.params.instanceId;
    
    try {
      const accountsPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      const projectsPath = path.join(this.storagePath, `${instanceId}-projects.json`);
      
      const exportData = {
        accounts: fs.existsSync(accountsPath) ? JSON.parse(fs.readFileSync(accountsPath, "utf8")) : [],
        settings: fs.existsSync(settingsPath) ? JSON.parse(fs.readFileSync(settingsPath, "utf8")) : {},
        projects: fs.existsSync(projectsPath) ? JSON.parse(fs.readFileSync(projectsPath, "utf8")) : {}
      };
      
      res.json({ success: true, data: exportData });
    } catch (error) {
      console.error(`[${this.name}] Error exporting data:`, error);
      res.status(500).json({ success: false, error: "Failed to export data" });
    }
  },

  handleImportData: function(req, res) {
    const instanceId = req.params.instanceId;
    const { accounts, settings, projects } = req.body;
    
    try {
      if (accounts) {
        const accountsPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
        fs.writeFileSync(accountsPath, JSON.stringify(accounts, null, 2));
      }
      
      if (settings) {
        const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
      }
      
      if (projects) {
        const projectsPath = path.join(this.storagePath, `${instanceId}-projects.json`);
        fs.writeFileSync(projectsPath, JSON.stringify(projects, null, 2));
      }
      
      // Update instance
      if (this.todoistInstances[instanceId]) {
        this.todoistInstances[instanceId].config = {
          ...this.todoistInstances[instanceId].config,
          ...settings,
          ...projects
        };
      }
      
      res.json({ success: true });
    } catch (error) {
      console.error(`[${this.name}] Error importing data:`, error);
      res.status(500).json({ success: false, error: "Failed to import data" });
    }
  },

  /* Core Functions */
  socketNotificationReceived: function(notification, payload) {
    switch (notification) {
      case "INIT_TODOIST":
        this.initTodoist(payload.instanceId, payload.config);
        break;
        
      case "GET_TODOIST_TASKS":
        this.getTodoistTasks(payload.instanceId, payload.config);
        break;
        
      case "REFRESH_TASKS":
        this.getTodoistTasks(payload.instanceId, this.todoistInstances[payload.instanceId]?.config || {});
        break;
    }
  },

  initTodoist: function(instanceId, config) {
    console.log(`[${this.name}] Initializing Todoist for instance ${instanceId}`);
    
    this.todoistInstances[instanceId] = {
      config: config,
      lastUpdated: null
    };
    
    // Load accounts from storage
    this.loadAccountsFromStorage(instanceId);
    
    // Load settings from storage
    this.loadSettingsFromStorage(instanceId);
    
    // Load projects configuration
    this.loadProjectsFromStorage(instanceId);
  },

  loadAccountsFromStorage: function(instanceId) {
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    const instance = this.todoistInstances[instanceId];
    
    if (!instance) return;
    
    try {
      if (fs.existsSync(accountConfigPath)) {
        const savedAccounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
        if (savedAccounts && savedAccounts.length > 0) {
          instance.config.accounts = savedAccounts;
          console.log(`[${this.name}] Loaded ${savedAccounts.length} accounts for ${instanceId}`);
        }
      } else {
        fs.writeFileSync(accountConfigPath, JSON.stringify([], null, 2));
      }
    } catch (error) {
      console.error(`[${this.name}] Error loading accounts:`, error);
    }
  },

  loadSettingsFromStorage: function(instanceId) {
    const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
    const instance = this.todoistInstances[instanceId];
    
    if (!instance) return;
    
    try {
      if (fs.existsSync(settingsPath)) {
        const savedSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        if (savedSettings) {
          instance.config = { ...instance.config, ...savedSettings };
        }
      }
    } catch (error) {
      console.error(`[${this.name}] Error loading settings:`, error);
    }
  },

  loadProjectsFromStorage: function(instanceId) {
    const projectsPath = path.join(this.storagePath, `${instanceId}-projects.json`);
    const instance = this.todoistInstances[instanceId];
    
    if (!instance) return;
    
    try {
      if (fs.existsSync(projectsPath)) {
        const savedProjects = JSON.parse(fs.readFileSync(projectsPath, "utf8"));
        if (savedProjects) {
          instance.config = { 
            ...instance.config,
            selectedProjects: savedProjects.selectedProjects || [],
            projectLimits: savedProjects.projectLimits || {}
          };
        }
      }
    } catch (error) {
      console.error(`[${this.name}] Error loading projects config:`, error);
    }
  },

  getTodoistTasks: function(instanceId, config) {
    const instance = this.todoistInstances[instanceId];
    if (!instance) {
      console.error(`[${this.name}] Instance ${instanceId} not found`);
      return;
    }
    
    // Update config from storage
    this.loadAccountsFromStorage(instanceId);
    this.loadSettingsFromStorage(instanceId);
    this.loadProjectsFromStorage(instanceId);
    
    if (!instance.config.accounts || instance.config.accounts.length === 0) {
      console.error(`[${this.name}] No accounts configured for ${instanceId}`);
      this.sendSocketNotification("TODOIST_TASKS", { instanceId, tasks: [] });
      return;
    }
    
    console.log(`[${this.name}] Fetching tasks for ${instanceId}`);
    
    const promises = instance.config.accounts.map(accountConfig => {
      const account = this.initializeAccount(accountConfig, instance.config);
      
      return this.fetchAccountData(account)
        .then(({ tasks, projects }) => {
          account.tasks = tasks;
          account.projects = projects;
          account.lastFetched = new Date();
          return tasks;
        })
        .catch(error => {
          console.error(`[${this.name}] Error fetching data for ${account.name}:`, error);
          return account.tasks || [];
        });
    });
    
    Promise.all(promises)
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
      })
      .catch(error => {
        console.error(`[${this.name}] Error processing tasks:`, error);
        this.sendSocketNotification("TODOIST_ERROR", { instanceId, error: error.message });
      });
  },

  initializeAccount: function(accountConfig, moduleConfig) {
    if (!this.accounts[accountConfig.token]) {
      this.accounts[accountConfig.token] = {
        token: accountConfig.token,
        name: accountConfig.name || "Todoist",
        category: accountConfig.category || "default",
        color: accountConfig.color || moduleConfig.themeColor || "#E84C3D",
        tasks: [],
        projects: [],
        lastFetched: null
      };
      
      // Fetch avatar for new account
      this.fetchUserAvatar(accountConfig.token);
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
      headers: { Authorization: `Bearer ${account.token}` }
    })
    .then(response => {
      if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
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
        headers: { Authorization: `Bearer ${account.token}` }
      }).then(res => res.ok ? res.json() : []),
      
      fetch("https://api.todoist.com/rest/v2/user", {
        headers: { Authorization: `Bearer ${account.token}` }
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
    
    // Separate tasks with due dates
    const dueTasks = filteredTasks.filter(task => task.due);
    const noDueTasks = filteredTasks.filter(task => !task.due);
    
    // Sort due tasks by date
    dueTasks.sort((a, b) => moment(a.due.date).diff(moment(b.due.date)));
    
    // Apply project grouping if configured
    if (config.groupBy === "project") {
      return this.groupTasksByProject(dueTasks, noDueTasks, config);
    }
    
    // Default: return all tasks sorted
    return [...dueTasks, ...noDueTasks].slice(0, config.maximumEntries);
  },

  groupTasksByProject: function(dueTasks, noDueTasks, config) {
    const projectGroups = {};
    const result = [];
    
    // Process due tasks first
    dueTasks.forEach(task => {
      if (!projectGroups[task.project_id]) {
        projectGroups[task.project_id] = {
          projectId: task.project_id,
          projectName: task.projectName,
          projectColor: task.projectColor,
          tasks: []
        };
      }
      
      if (projectGroups[task.project_id].tasks.length < (config.projectLimits[task.project_id] || config.maximumEntries)) {
        projectGroups[task.project_id].tasks.push(task);
      }
    });
    
    // Process tasks without due dates
    noDueTasks.forEach(task => {
      if (!projectGroups[task.project_id]) {
        projectGroups[task.project_id] = {
          projectId: task.project_id,
          projectName: task.projectName,
          projectColor: task.projectColor,
          tasks: []
        };
      }
      
      if (projectGroups[task.project_id].tasks.length < (config.projectLimits[task.project_id] || config.maximumEntries)) {
        projectGroups[task.project_id].tasks.push(task);
      }
    });
    
    // Convert to array and apply project selection
    Object.values(projectGroups).forEach(group => {
      if (config.selectedProjects.length === 0 || config.selectedProjects.includes(group.projectId)) {
        result.push({
          isProjectHeader: true,
          ...group
        });
        result.push(...group.tasks);
      }
    });
    
    return result.slice(0, config.maximumEntries);
  },

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

  /* Avatar Handling */
  fetchUserAvatar: function(token) {
    const avatarPath = path.join(this.cachePath, `avatar_${token.substring(0, 8)}.jpg`);
    
    // Skip if already cached
    if (fs.existsSync(avatarPath)) return;
    
    fetch("https://api.todoist.com/rest/v2/user", {
      headers: { Authorization: `Bearer ${token}` }
    })
    .then(res => res.ok ? res.json() : null)
    .then(user => {
      if (user?.avatar_url) {
        return fetch(user.avatar_url)
          .then(res => res.buffer())
          .then(buffer => {
            fs.writeFileSync(avatarPath, buffer);
            console.log(`[${this.name}] Cached avatar for token ${token.substring(0, 5)}...`);
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
  updateAllInstances: function(instanceId, data) {
    Object.keys(this.todoistInstances).forEach(id => {
      if (id === instanceId || id.includes('todoist')) {
        this.todoistInstances[id].config = {
          ...this.todoistInstances[id].config,
          ...data
        };
      }
    });
    
    this.sendSocketNotification("TODOIST_UPDATED", {
      instanceId,
      ...data
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
  }
});