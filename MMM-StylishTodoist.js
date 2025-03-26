/*
 * MMM-StylishTodoist
 * MIT license
 *
 * A stylish, minimalistic Todoist tasks module for MagicMirror²
 * Based on MMM-StylishCalendar design
 */

"use strict";

Module.register("MMM-StylishTodoist", {
  defaults: {
    name: "MMM-StylishTodoist",
    
    // Todoist configuration
    accounts: [],
    maximumEntries: 10,
    displaySymbol: true,
    defaultSymbol: "task",
    maxTitleLength: 50,
    sortType: "date", // "date", "priority", "project"
    showCompleted: false,
    showOverdue: true,
    
    // Appearance
    animateIn: true,
    fadeAnimations: true,
    textAnimations: true,
    transitionAnimations: true,
    colorizeByProject: true,
    roundedCorners: true,
    showDueDate: true,
    showDescription: false,
    showProject: true,
    showAvatar: true,
    
    // View options
    groupBy: "project", // "date", "project", "priority", "none"
    showIcons: true,
    dayLimit: 7,
    showLegend: true,
    
    // Locale settings - defaults to system locale
    language: config.language,
    dateFormat: "MMM Do",
    
    // Update intervals (seconds)
    updateInterval: 60,
    updateIntervalHidden: 180,
    
    // Advanced theming
    themeColor: "#e84c3d",
    experimentalCSSOverridesForMM2: false,
  },

  start: function() {
    this.logBadge();
    
    this.loaded = false;
    this.tasks = [];
    this.isHidden = false;
    this.currentIntervalId = null;
    this.firstFetch = true;
    
    // Make sure update interval is reasonable (default 60 seconds)
    if (!this.config.updateInterval || this.config.updateInterval < 30) {
      this.config.updateInterval = 60;
    }
    
    this.moduleVersion = "1.0.0";
    
    // Create stable ID for this instance based on module position
    const positionKey = this.data.position || "unknown";
    this.instanceId = `mm-stylish-todoist-${positionKey.replace("_", "-")}`;
    console.log(`[${this.name}] Starting module with instance ID: ${this.instanceId}`);
    
    // Try to load accounts from config if provided
    if (this.config.accounts && this.config.accounts.length === 0) {
      console.log(`[${this.name}] No accounts in config, checking for added accounts via setup UI`);
      
      // Try to load hardcoded accounts for instance ID if it exists
      try {
        // This is a temporary fix - we hard-code known accounts
        this.config.accounts = [
          {
            name: "Personal",
            token: "YOUR_TODOIST_API_TOKEN_HERE",
            symbol: "user",
            color: "#e84c3d",
            category: "personal",
          },
          // You can add more accounts here
          // {
          //   name: "Work",
          //   token: "YOUR_WORK_TODOIST_API_TOKEN",
          //   symbol: "briefcase",
          //   color: "#4287f5",
          //   category: "work",
          // }
        ];
        console.log(`[${this.name}] Added ${this.config.accounts.length} hardcoded accounts for testing`);
      } catch (e) {
        console.error(`[${this.name}] Error adding hardcoded accounts:`, e);
      }
    }
    
    // Send credentials to backend and start update cycle
    this.sendConfig();
    this.updateTodoistTasks();
    this.scheduleUpdate();
    
    // Setup some useful CSS variables
    this.root = document.querySelector(":root");
    this.setupThemeColors();
  },
  
  getTranslations: function() {
    return {
      en: "translations/en.json",
      de: "translations/de.json",
    };
  },
  
  getScripts: function() {
    return [
      "moment.js",
      this.file("utils/TaskBuilder.js")
    ];
  },
  
  getStyles: function() {
    return [
      this.file("css/MMM-StylishTodoist.css"),
      "https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css"
    ];
  },
  
  getDom: function() {
    // Create main wrapper with module styling
    const wrapper = document.createElement("div");
    wrapper.className = "MMM-StylishTodoist-wrapper";
    
    if (!this.loaded) {
      // Show loading message
      wrapper.innerHTML = this.translate("LOADING");
      wrapper.className = "MMM-StylishTodoist-wrapper dimmed";
      console.log(`[${this.name}] Tasks loading - awaiting tasks from backend`);
      return wrapper;
    }
    
    if (this.tasks.length === 0) {
      // No tasks to display
      if (!this.config.accounts || this.config.accounts.length === 0) {
        // No accounts configured
        wrapper.innerHTML = `<div style="color:yellow">No Todoist accounts configured.<br>Visit http://localhost:8200/MMM-StylishTodoist/setup<br>to add accounts.</div>`;
        wrapper.className = "MMM-StylishTodoist-wrapper dimmed";
        console.log(`[${this.name}] No accounts configured`);
      } else {
        // Accounts configured but no tasks
        wrapper.innerHTML = this.translate("NO_TASKS");
        wrapper.className = "MMM-StylishTodoist-wrapper dimmed";
        console.log(`[${this.name}] No tasks to display - ${this.config.accounts.length} accounts but tasks array is empty`);
      }
      return wrapper;
    }
    
    console.log(`[${this.name}] Rendering ${this.tasks.length} tasks`);
    
    // Build tasks based on selected grouping
    const tasksDom = this.builder.buildTaskList(this.tasks, this.config);
    wrapper.appendChild(tasksDom);
    
    return wrapper;
  },
  
  socketNotificationReceived: function(notification, payload) {
    if (notification === "TODOIST_TASKS") {
      if (payload.instanceId === this.instanceId) {
        console.log(`[${this.name}] Received ${payload.tasks.length} tasks from backend`);
        this.tasks = payload.tasks;
        this.loaded = true;
        this.updateDom();
      }
    } else if (notification === "TODOIST_UPDATED") {
      if (payload.instanceId === this.instanceId) {
        console.log(`[${this.name}] Todoist config updated with ${payload.accounts.length} accounts`);
        this.config.accounts = payload.accounts;
        this.sendConfig();
        this.updateTodoistTasks();
      }
    } else if (notification === "SETTINGS_UPDATED") {
      if (payload.instanceId === this.instanceId) {
        if (payload.settings.maximumEntries) {
          this.config.maximumEntries = payload.settings.maximumEntries;
        }
        this.sendConfig();
        this.updateTodoistTasks();
      }
    }
  },
  
  notificationReceived: function(notification, payload, sender) {
    if (notification === "MODULE_DOM_CREATED") {
      this.builder = new TaskBuilder(
        this.translate,
        this.config
      );
    } else if (notification === "TODOIST_TASKS") {
      this.tasks = payload;
      this.loaded = true;
      this.updateDom();
    }
  },
  
  suspend: function() {
    this.isHidden = true;
    this.scheduleUpdate();
  },
  
  resume: function() {
    this.isHidden = false;
    this.scheduleUpdate();
    this.updateDom();
  },
  
  /* Helper Methods */
  
  scheduleUpdate: function() {
    const self = this;
    clearInterval(this.currentIntervalId);
    
    // Interval depends on whether the module is hidden
    const interval = this.isHidden 
      ? this.config.updateIntervalHidden 
      : this.config.updateInterval;
    
    console.log(`[${this.name}] Scheduling updates every ${interval} seconds`);
    
    this.currentIntervalId = setInterval(function() {
      console.log(`[${self.name}] Performing scheduled update...`);
      self.updateTodoistTasks();
    }, interval * 1000);
  },
  
  updateTodoistTasks: function() {
    this.sendSocketNotification("GET_TODOIST_TASKS", {
      instanceId: this.instanceId,
      config: this.config
    });
  },
  
  sendConfig: function() {
    this.sendSocketNotification("INIT_TODOIST", {
      instanceId: this.instanceId,
      config: this.config
    });
  },
  
  setupThemeColors: function() {
    const color = this.config.themeColor;
    
    // Set main theme color
    this.root.style.setProperty("--todoist-theme-color", color);
    
    // Calculate variants
    this.root.style.setProperty("--todoist-theme-color-light", this.lightenColor(color, 20));
    this.root.style.setProperty("--todoist-theme-color-dark", this.darkenColor(color, 20));
  },
  
  lightenColor: function(color, percent) {
    const num = parseInt(color.replace("#", ""), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = (num >> 8 & 0x00FF) + amt;
    const B = (num & 0x0000FF) + amt;
    
    return "#" + (
      0x1000000 + 
      (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000 + 
      (G < 255 ? G < 1 ? 0 : G : 255) * 0x100 + 
      (B < 255 ? B < 1 ? 0 : B : 255)
    ).toString(16).slice(1);
  },
  
  darkenColor: function(color, percent) {
    return this.lightenColor(color, -percent);
  },
  
  logBadge: function() {
    console.log(
      ` ⠖ %c MMM-StylishTodoist %c ${this.moduleVersion}`,
      "background-color: #555; color: #fff; margin: 0.4em 0em 0.4em 0.4em; padding: 5px 5px 5px 5px; border-radius: 7px 0 0 7px; font-family: DejaVu Sans, Verdana, Geneva, sans-serif;",
      "background-color: #e84c3d; color: #fff; margin: 0.4em 0.4em 0.4em 0em; padding: 5px 5px 5px 5px; border-radius: 0 7px 7px 0; font-family: DejaVu Sans, Verdana, Geneva, sans-serif; text-shadow: 0 1px 0 rgba(1, 1, 1, 0.3)"
    );
  }
});