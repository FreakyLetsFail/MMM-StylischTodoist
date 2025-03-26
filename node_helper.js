/*
 * MMM-StylishTodoist
 * MIT license
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
    console.log(`[MMM-StylishTodoist] Node helper started`);
    
    this.accounts = {};
    this.todoistInstances = {};
    this.settings = {};
    
    // Create storage path
    this.storagePath = path.join(this.path, "accounts");
    if (!fs.existsSync(this.storagePath)) {
      fs.mkdirSync(this.storagePath, { recursive: true });
    }
    
    // Initialize express app for the setup UI with custom port 8200
    this.expressApp = express();
    this.expressApp.use(bodyParser.json());
    this.expressApp.use(bodyParser.urlencoded({ extended: true }));
    this.expressApp.use("/MMM-StylishTodoist", express.static(path.resolve(module.exports.path + "/public")));
    
    // Start a separate server on port 8200
    try {
      this.server = this.expressApp.listen(8200, () => {
        console.log(`[MMM-StylishTodoist] Setup server running at http://localhost:8200/MMM-StylishTodoist/setup`);
      });
      
      // Add error handling for the server
      this.server.on('error', (e) => {
        if (e.code === 'EADDRINUSE') {
          console.error(`[MMM-StylishTodoist] Port 8200 is already in use! Setup UI may not be accessible.`);
        } else {
          console.error(`[MMM-StylishTodoist] Server error:`, e);
        }
      });
    } catch (error) {
      console.error(`[MMM-StylishTodoist] Failed to start server on port 8200:`, error);
    }
    
    // Setup API endpoints
    this.setupAPIRoutes();
    
    // Check existing account files
    try {
      if (fs.existsSync(this.storagePath)) {
        const files = fs.readdirSync(this.storagePath);
        const accountFiles = files.filter(file => file.endsWith('-accounts.json'));
        console.log(`[MMM-StylishTodoist] Found ${accountFiles.length} account files in storage`);
        
        if (accountFiles.length > 0) {
          accountFiles.forEach(file => {
            try {
              const fullPath = path.join(this.storagePath, file);
              const fileStats = fs.statSync(fullPath);
              const fileSizeMB = fileStats.size / (1024 * 1024);
              const lastModified = new Date(fileStats.mtime).toLocaleString();
              
              console.log(`[MMM-StylishTodoist] - ${file}: ${fileSizeMB.toFixed(2)} MB, modified: ${lastModified}`);
              
              // Check file content
              const accData = JSON.parse(fs.readFileSync(fullPath, "utf8"));
              if (accData && Array.isArray(accData)) {
                console.log(`[MMM-StylishTodoist]   - Contains ${accData.length} accounts`);
              }
            } catch (err) {
              console.error(`[MMM-StylishTodoist] Error reading file ${file}:`, err);
            }
          });
        }
      }
    } catch (e) {
      console.error(`[MMM-StylishTodoist] Error scanning accounts directory:`, e);
    }
    
    // Log setup information
    console.log(`[MMM-StylishTodoist] Storage path: ${this.storagePath}`);
    console.log(`[MMM-StylishTodoist] Setup UI available at: /MMM-StylishTodoist/setup.html`);
  },
  
  setupAPIRoutes: function() {
    // Setup route for the setup UI
    this.expressApp.get("/MMM-StylishTodoist/setup", (req, res) => {
      res.sendFile(path.join(this.path, "public", "setup.html"));
    });
    
    // ==== Account API endpoints ====
    // Get all accounts for an instance
    this.expressApp.get("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
      
      try {
        if (fs.existsSync(accountConfigPath)) {
          const accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
          console.log(`[MMM-StylishTodoist] API: Returning ${accounts.length} accounts for ${instanceId}`);
          res.json({ success: true, accounts: accounts });
        } else {
          console.log(`[MMM-StylishTodoist] API: No account file found for ${instanceId}, returning empty array`);
          
          // Check for any account file and use it
          const files = fs.readdirSync(this.storagePath);
          const accountFiles = files.filter(file => file.endsWith('-accounts.json'));
          
          if (accountFiles.length > 0) {
            console.log(`[MMM-StylishTodoist] API: Found other account files: ${accountFiles.join(', ')}`);
            // Use the first file found
            const firstFilePath = path.join(this.storagePath, accountFiles[0]);
            const otherAccounts = JSON.parse(fs.readFileSync(firstFilePath, "utf8"));
            
            // Copy this file to the requested instance ID
            fs.writeFileSync(accountConfigPath, JSON.stringify(otherAccounts, null, 2));
            console.log(`[MMM-StylishTodoist] API: Copied ${otherAccounts.length} accounts to ${accountConfigPath}`);
            
            return res.json({ success: true, accounts: otherAccounts });
          }
          
          res.json({ success: true, accounts: [] });
        }
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error loading accounts:`, error);
        res.status(500).json({ success: false, error: "Failed to load accounts" });
      }
    });
    
    // Add a new account
    this.expressApp.post("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
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
        
        // Check if account already exists
        const exists = accounts.some(acc => acc.token === accountConfig.token);
        if (exists) {
          return res.status(409).json({ success: false, error: "Account with this token already exists" });
        }
        
        accounts.push(accountConfig);
        fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
        
        // Update all instances with this account
        Object.keys(this.todoistInstances).forEach(id => {
          // Add to all instances that match the current ID pattern
          if (id === instanceId || id.includes('todoist')) {
            console.log(`[MMM-StylishTodoist] Adding account to instance: ${id}`);
            if (!this.todoistInstances[id].config.accounts) {
              this.todoistInstances[id].config.accounts = [];
            }
            this.todoistInstances[id].config.accounts.push(accountConfig);
          }
        });
        
        // Notify the module about the new account
        this.sendSocketNotification("TODOIST_UPDATED", {
          instanceId: instanceId,
          accounts: accounts
        });
        
        console.log(`[MMM-StylishTodoist] Account added: ${accountConfig.name}`);
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error saving account:`, error);
        res.status(500).json({ success: false, error: "Failed to save account" });
      }
    });
    
    // Update an existing account
    this.expressApp.put("/MMM-StylishTodoist/api/accounts/:instanceId", (req, res) => {
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
        
        // Find the account to update
        const index = accounts.findIndex(acc => acc.token === updatedAccount.token);
        if (index === -1) {
          return res.status(404).json({ success: false, error: "Account not found" });
        }
        
        // Update the account
        accounts[index] = updatedAccount;
        fs.writeFileSync(accountConfigPath, JSON.stringify(accounts, null, 2));
        
        // Notify the module about the updated account
        this.sendSocketNotification("TODOIST_UPDATED", {
          instanceId: instanceId,
          accounts: accounts
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error updating account:`, error);
        res.status(500).json({ success: false, error: "Failed to update account" });
      }
    });
    
    // Delete an account
    this.expressApp.delete("/MMM-StylishTodoist/api/accounts/:instanceId/:token", (req, res) => {
      const instanceId = req.params.instanceId;
      const token = decodeURIComponent(req.params.token);
      
      const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
      
      try {
        if (!fs.existsSync(accountConfigPath)) {
          return res.status(404).json({ success: false, error: "No accounts found" });
        }
        
        let accounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
        
        // Filter out the account to delete
        const newAccounts = accounts.filter(acc => acc.token !== token);
        
        // If nothing was removed, the account wasn't found
        if (newAccounts.length === accounts.length) {
          return res.status(404).json({ success: false, error: "Account not found" });
        }
        
        fs.writeFileSync(accountConfigPath, JSON.stringify(newAccounts, null, 2));
        
        // Notify the module about the deleted account
        this.sendSocketNotification("TODOIST_UPDATED", {
          instanceId: instanceId,
          accounts: newAccounts
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error deleting account:`, error);
        res.status(500).json({ success: false, error: "Failed to delete account" });
      }
    });
    
    // Get settings
    this.expressApp.get("/MMM-StylishTodoist/api/settings/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      
      try {
        if (fs.existsSync(settingsPath)) {
          const settings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
          console.log(`[MMM-StylishTodoist] API: Loaded settings for ${instanceId}:`, settings);
          res.json({ success: true, settings: settings });
        } else {
          // Create default settings file if it doesn't exist
          const defaultSettings = { maximumEntries: 10 };
          fs.writeFileSync(settingsPath, JSON.stringify(defaultSettings, null, 2));
          console.log(`[MMM-StylishTodoist] API: Created default settings for ${instanceId}`);
          res.json({ success: true, settings: defaultSettings });
        }
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error loading settings:`, error);
        res.status(500).json({ success: false, error: "Failed to load settings" });
      }
    });
    
    // Save settings
    this.expressApp.post("/MMM-StylishTodoist/api/settings/:instanceId", (req, res) => {
      const instanceId = req.params.instanceId;
      const settings = req.body;
      
      if (settings.maximumEntries === undefined) {
        return res.status(400).json({ success: false, error: "Missing required fields" });
      }
      
      const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
      
      try {
        fs.writeFileSync(settingsPath, JSON.stringify(settings, null, 2));
        
        // Notify the module about the updated settings
        this.sendSocketNotification("SETTINGS_UPDATED", {
          instanceId: instanceId,
          settings: settings
        });
        
        res.json({ success: true });
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error saving settings:`, error);
        res.status(500).json({ success: false, error: "Failed to save settings" });
      }
    });
  },
  
  socketNotificationReceived: function(notification, payload) {
    switch (notification) {
      case "INIT_TODOIST":
        this.initTodoist(payload.instanceId, payload.config);
        break;
        
      case "GET_TODOIST_TASKS":
        this.getTodoistTasks(payload.instanceId, payload.config);
        break;
    }
  },
  
  initTodoist: function(instanceId, config) {
    console.log(`[MMM-StylishTodoist] Initializing Todoist for instance ${instanceId}`);
    
    this.todoistInstances[instanceId] = {
      config: config,
      accounts: []
    };
    
    // Try to load accounts from storage first - two-step approach
    // 1. Direct match with instanceId
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    let accountLoaded = false;
    
    if (fs.existsSync(accountConfigPath)) {
      try {
        const savedAccounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
        if (savedAccounts && savedAccounts.length > 0) {
          // Use saved accounts instead of config accounts
          config.accounts = savedAccounts;
          console.log(`[MMM-StylishTodoist] Loaded ${savedAccounts.length} accounts directly from ${accountConfigPath}`);
          accountLoaded = true;
        }
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error loading accounts from storage:`, error);
      }
    } else {
      // Create empty file if it doesn't exist
      try {
        fs.writeFileSync(accountConfigPath, JSON.stringify([], null, 2));
        console.log(`[MMM-StylishTodoist] Created empty account config file at ${accountConfigPath}`);
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error creating account config file:`, error);
      }
    }
    
    // 2. If not found directly, look for any account file and use the first one
    if (!accountLoaded) {
      try {
        console.log(`[MMM-StylishTodoist] No direct account match, searching all accounts...`);
        const files = fs.readdirSync(this.storagePath);
        const accountFiles = files.filter(file => file.endsWith('-accounts.json'));
        
        if (accountFiles.length > 0) {
          const firstAccountFile = accountFiles[0];
          const fullPath = path.join(this.storagePath, firstAccountFile);
          const savedAccounts = JSON.parse(fs.readFileSync(fullPath, "utf8"));
          
          if (savedAccounts && savedAccounts.length > 0) {
            config.accounts = savedAccounts;
            console.log(`[MMM-StylishTodoist] Loaded ${savedAccounts.length} accounts from found file: ${fullPath}`);
            
            // Also save with the new instance ID for future use
            fs.writeFileSync(accountConfigPath, JSON.stringify(savedAccounts, null, 2));
            console.log(`[MMM-StylishTodoist] Saved accounts to new instance location: ${accountConfigPath}`);
            accountLoaded = true;
          }
        } else {
          console.log(`[MMM-StylishTodoist] No account files found in ${this.storagePath}`);
        }
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error searching for account files:`, error);
      }
    }
    
    // Try to load settings from storage
    const settingsPath = path.join(this.storagePath, `${instanceId}-settings.json`);
    if (fs.existsSync(settingsPath)) {
      try {
        const savedSettings = JSON.parse(fs.readFileSync(settingsPath, "utf8"));
        if (savedSettings) {
          // Apply saved settings
          if (savedSettings.maximumEntries !== undefined) {
            config.maximumEntries = savedSettings.maximumEntries;
          }
          console.log(`[MMM-StylishTodoist] Loaded settings from storage`);
        }
      } catch (error) {
        console.error(`[MMM-StylishTodoist] Error loading settings from storage:`, error);
      }
    }
    
    // Load accounts
    if (config.accounts.length > 0) {
      this.loadAccounts(instanceId);
    }
  },
  
  loadAccounts: function(instanceId) {
    const instance = this.todoistInstances[instanceId];
    if (!instance) {
      console.error(`[MMM-StylishTodoist] Instance ${instanceId} not found`);
      return;
    }
    
    // Log the accounts we're loading
    console.log(`[MMM-StylishTodoist] Loading ${instance.config.accounts.length} accounts for instance ${instanceId}`);
    
    if (!instance.config.accounts || instance.config.accounts.length === 0) {
      console.log(`[MMM-StylishTodoist] No accounts found in config for instance ${instanceId}`);
    }
    
    instance.config.accounts.forEach(account => {
      if (!this.accounts[account.token]) {
        // Create a new account entry
        this.accounts[account.token] = {
          token: account.token,
          name: account.name || "Todoist",
          symbol: account.symbol || instance.config.defaultSymbol,
          category: account.category || "default",
          color: account.color || "#e84c3d",
          tasks: [],
          projects: [],
          labels: [],
          lastFetched: null
        };
        
        console.log(`[MMM-StylishTodoist] Added account: ${account.name}`);
      }
    });
  },
  
  getTodoistTasks: function(instanceId, config) {
    const instance = this.todoistInstances[instanceId];
    if (!instance) {
      console.error(`[MMM-StylishTodoist] Instance ${instanceId} not found in getTodoistTasks`);
      return;
    }
    
    console.log(`[MMM-StylishTodoist] Getting Todoist tasks for instance ${instanceId}`);
    
    // Always check for account files on disk
    const accountConfigPath = path.join(this.storagePath, `${instanceId}-accounts.json`);
    try {
      if (fs.existsSync(accountConfigPath)) {
        const savedAccounts = JSON.parse(fs.readFileSync(accountConfigPath, "utf8"));
        if (savedAccounts && savedAccounts.length > 0) {
          // Update config with saved accounts
          console.log(`[MMM-StylishTodoist] Loading ${savedAccounts.length} accounts from ${accountConfigPath}`);
          
          // Force config update
          instance.config.accounts = savedAccounts;
          config.accounts = savedAccounts;
        } else {
          console.log(`[MMM-StylishTodoist] Account file exists but contains no accounts: ${accountConfigPath}`);
        }
      } else {
        console.log(`[MMM-StylishTodoist] No account file found at: ${accountConfigPath}`);
      }
    } catch (error) {
      console.error(`[MMM-StylishTodoist] Error loading accounts in getTodoistTasks:`, error);
    }
    
    // Reload accounts in case they changed
    this.loadAccounts(instanceId);
    
    // Check if we actually have accounts to fetch
    if (!instance.config.accounts || instance.config.accounts.length === 0) {
      console.error(`[MMM-StylishTodoist] No accounts configured for instance ${instanceId}`);
      
      // Send empty tasks array to avoid loading indicator
      this.sendSocketNotification("TODOIST_TASKS", {
        instanceId: instanceId,
        tasks: []
      });
      
      return;
    }
    
    console.log(`[MMM-StylishTodoist] Fetching tasks from ${instance.config.accounts.length} accounts`);
    
    const promises = [];
    
    // Always fetch all accounts on each update to ensure we have the most recent data
    instance.config.accounts.forEach(accountConfig => {
      const account = this.accounts[accountConfig.token];
      
      if (!account) return;
      
      // First fetch projects to get project names and colors
      const projectsPromise = this.fetchProjects(instanceId, account)
        .then(projects => {
          account.projects = projects;
          return projects;
        })
        .catch(error => {
          console.error(`[MMM-StylishTodoist] Error fetching projects for account ${account.name}:`, error);
          return account.projects || [];
        });
      
      // Then fetch tasks
      const tasksPromise = projectsPromise.then(() => {
        return this.fetchTasks(instanceId, account)
          .then(tasks => {
            account.tasks = tasks;
            account.lastFetched = moment();
            console.log(`[MMM-StylishTodoist] Updated account ${account.name} with ${tasks.length} tasks`);
            return tasks;
          })
          .catch(error => {
            console.error(`[MMM-StylishTodoist] Error fetching tasks for account ${account.name}:`, error);
            // Return cached tasks if available, otherwise empty array
            return account.tasks || [];
          });
      });
      
      promises.push(tasksPromise);
    });
    
    // When all accounts are fetched, send tasks back
    Promise.all(promises)
      .then(results => {
        // Flatten tasks from all accounts
        let allTasks = [].concat(...results);
        
        // Create a separate array for tasks with due dates
        const tasksWithDueDate = allTasks.filter(task => task.due);
        const tasksWithoutDueDate = allTasks.filter(task => !task.due);
        
        console.log(`[MMM-StylishTodoist] Sorting ${tasksWithDueDate.length} tasks with due dates and ${tasksWithoutDueDate.length} tasks without due dates`);
        
        // Sort tasks with due dates by date (earlier first)
        tasksWithDueDate.sort((a, b) => {
          return moment(a.due.date).valueOf() - moment(b.due.date).valueOf();
        });
        
        // Now group both sets of tasks by project
        const dueByProject = {};
        const noDueByProject = {};
        
        // Group tasks with due dates by project
        tasksWithDueDate.forEach(task => {
          const projectId = task.project_id || "no_project";
          if (!dueByProject[projectId]) {
            dueByProject[projectId] = [];
          }
          dueByProject[projectId].push(task);
        });
        
        // Group tasks without due dates by project
        tasksWithoutDueDate.forEach(task => {
          const projectId = task.project_id || "no_project";
          if (!noDueByProject[projectId]) {
            noDueByProject[projectId] = [];
          }
          noDueByProject[projectId].push(task);
        });
        
        // Flatten the arrays keeping project grouping, with due date tasks first
        const sortedTasksWithDue = Object.values(dueByProject).flat();
        const sortedTasksNoDue = Object.values(noDueByProject).flat();
        
        // Combine arrays: first all tasks with due dates, then all without
        allTasks = [...sortedTasksWithDue, ...sortedTasksNoDue];
        
        console.log(`[MMM-StylishTodoist] Sorting complete. First 3 tasks:`);
        allTasks.slice(0, 3).forEach((task, i) => {
          console.log(`[MMM-StylishTodoist] Task ${i+1}: ${task.content.substring(0, 30)}... - Due: ${task.due ? task.due.date : 'none'}, Project: ${task.projectName}`);
        });
        
        // Filter tasks based on config
        allTasks = this.filterTasks(allTasks, config);
        
        console.log(`[MMM-StylishTodoist] Sending ${allTasks.length} tasks to instance ${instanceId}`);
        
        this.sendSocketNotification("TODOIST_TASKS", {
          instanceId: instanceId,
          tasks: allTasks
        });
      })
      .catch(error => {
        console.error("[MMM-StylishTodoist] Error getting tasks:", error);
      });
  },
  
  fetchProjects: function(instanceId, account) {
    console.log(`[MMM-StylishTodoist] Fetching projects for account ${account.name}`);
    
    const fetchOptions = {
      headers: {
        "Authorization": `Bearer ${account.token}`
      }
    };
    
    return fetch("https://api.todoist.com/rest/v2/projects", fetchOptions)
      .then(response => {
        if (!response.ok) {
          console.error(`[MMM-StylishTodoist] Error fetching projects, status: ${response.status}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(projects => {
        console.log(`[MMM-StylishTodoist] Fetched ${projects.length} projects for account ${account.name}`);
        // Add detailed logging for each project
        projects.forEach(project => {
          console.log(`[MMM-StylishTodoist] - Project: ${project.name}, ID: ${project.id}, Color: ${project.color}`);
        });
        return projects;
      });
  },
  
  fetchTasks: function(instanceId, account) {
    console.log(`[MMM-StylishTodoist] Fetching tasks for account ${account.name} with token: ${account.token ? account.token.substring(0, 5) + '...' : 'undefined'}`);
    
    const fetchOptions = {
      headers: {
        "Authorization": `Bearer ${account.token}`
      }
    };
    
    // First fetch user info to get avatar
    const userPromise = fetch("https://api.todoist.com/rest/v2/user", fetchOptions)
      .then(response => {
        if (!response.ok) {
          console.error(`[MMM-StylishTodoist] Error fetching user, status: ${response.status}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(userData => {
        console.log(`[MMM-StylishTodoist] Successfully fetched user data for ${account.name}, avatar URL: ${userData.avatar_url ? 'present' : 'missing'}`);
        return userData;
      })
      .catch(error => {
        console.error(`[MMM-StylishTodoist] Error fetching user info for account ${account.name}:`, error);
        return null; // Return null if we can't fetch user info
      });
    
    // Then fetch tasks
    const tasksPromise = fetch("https://api.todoist.com/rest/v2/tasks", fetchOptions)
      .then(response => {
        if (!response.ok) {
          console.error(`[MMM-StylishTodoist] Error fetching tasks, status: ${response.status}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        return response.json();
      })
      .then(tasks => {
        console.log(`[MMM-StylishTodoist] Successfully fetched ${tasks.length} tasks for ${account.name}`);
        return tasks;
      });
    
    // Combine the results
    return Promise.all([userPromise, tasksPromise])
      .then(([userInfo, tasks]) => {
        console.log(`[MMM-StylishTodoist] Processing ${tasks.length} tasks with user info ${userInfo ? 'present' : 'missing'}`);
        
        // Enhance tasks with account information
        return tasks.map(task => {
          // Find project information
          const project = account.projects.find(p => p.id === task.project_id) || {
            name: "Unknown Project",
            color: "grey"
          };
          
          const taskWithInfo = {
            ...task,
            accountName: account.name,
            accountSymbol: account.symbol,
            accountCategory: account.category,
            accountColor: account.color,
            projectName: project.name,
            projectColor: project.color,
            // Add user avatar URL if available
            avatar: userInfo ? userInfo.avatar_url : null,
            person: account.person || "default"
          };
          
          return taskWithInfo;
        });
      });
  },
  
  filterTasks: function(tasks, config) {
    if (!tasks || tasks.length === 0) {
      console.log(`[MMM-StylishTodoist] No tasks to filter`);
      return [];
    }
    
    // Default values if config is missing
    const maxEntries = config.maximumEntries || 10;
    const showCompleted = config.showCompleted || false;
    const showOverdue = config.showOverdue !== false; // Default to true
    
    console.log(`[MMM-StylishTodoist] Filtering tasks: ${tasks.length} tasks, max ${maxEntries} entries`);
    
    // Filter based on config
    let filteredTasks = tasks;
    
    // Remove completed tasks if not showing them
    if (!showCompleted) {
      filteredTasks = filteredTasks.filter(task => !task.completed);
    }
    
    // Handle overdue tasks
    const now = moment();
    if (!showOverdue) {
      filteredTasks = filteredTasks.filter(task => {
        if (!task.due) return true; // Tasks without due date are kept
        return moment(task.due.date).isAfter(now);
      });
    }
    
    console.log(`[MMM-StylishTodoist] After filtering: ${filteredTasks.length} tasks remain`);
    
    // Return tasks limited by maximumEntries count
    const limitedTasks = filteredTasks.slice(0, maxEntries);
    console.log(`[MMM-StylishTodoist] After entry limit: ${limitedTasks.length} tasks will be shown`);
    
    return limitedTasks;
  }
});