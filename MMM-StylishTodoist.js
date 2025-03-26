Module.register("MMM-StylishTodoist", {
    defaults: {
      updateInterval: 10 * 60 * 1000,
      maximumEntries: 30,
      fadeSpeed: 3000,
      sortBy: "due_date",
      groupBy: "project",
      showProjectHeaders: true,
      showDividers: true,
      showAvatars: true,
      showPriority: true,
      themeColor: "#E84C3D",
      dateFormat: "DD.MM.YYYY",
      projects: [],
      customProjectLimits: {},
      dueTasksLimit: 7,
      apiVersion: "v2",
      apiToken: "",   // Add your Todoist API token here
      dayLimit: 7    // Maximum number of days to show
    },
  
    requiresVersion: "2.15.0",
  
    // Replace the start function in MMM-StylishTodoist.js with this:
    start: function() {
      Log.info(`Starting module: ${this.name}`);
      
      // Generate a unique identifier for this module instance
      this.identifier = this.identifier || `todoist_${Math.floor(Math.random() * 1000)}`;
      
      this.tasks = [];
      this.projects = [];
      this.loaded = false;
      this.error = null;
      this.lastUpdated = null;
      
      // Send the configuration to the node helper
      this.sendSocketNotification("CONFIG", {
        identifier: this.identifier,
        config: this.config
      });
      
      // Schedule the first update
      this.scheduleUpdate();
    },

    // And modify the scheduleUpdate function:
    scheduleUpdate: function() {
      setInterval(() => {
        this.sendSocketNotification("UPDATE_TASKS", {
          identifier: this.identifier
        });
      }, this.config.updateInterval);
      
      // Also do an immediate update
      setTimeout(() => {
        this.sendSocketNotification("UPDATE_TASKS", {
          identifier: this.identifier
        });
      }, 1000);
    },
  
    getStyles: function() {
      return [
        "MMM-StylishTodoist.css",
        "font-awesome.css",
        "https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap"
      ];
    },
  
    getScripts: function() {
      return ["moment.js"];
    },
  
    getTranslations: function() {
      return {
        en: "translations/en.json",
        de: "translations/de.json"
      };
    },
  
    getDom: function() {
      const wrapper = document.createElement("div");
      wrapper.className = "todoist-wrapper";
      
      if (this.error) {
        wrapper.innerHTML = this.translate("ERROR_LOADING");
        return wrapper;
      }
  
      if (!this.loaded) {
        wrapper.innerHTML = `<div class="loading">${this.translate("LOADING")}...</div>`;
        return wrapper;
      }
  
      // Header
      const header = document.createElement("div");
      header.className = "todoist-header";
      header.innerHTML = `
        <div class="title">
          <i class="fas fa-tasks"></i>
          <span>${this.translate("TODOIST_TASKS")}</span>
        </div>
        ${this.lastUpdated ? `<div class="updated">${this.translate("UPDATED")}: ${moment(this.lastUpdated).format(this.config.dateFormat + " HH:mm")}</div>` : ""}
      `;
      wrapper.appendChild(header);
  
      // Content
      const content = document.createElement("div");
      content.className = "todoist-content";
      
      // Due tasks section
      const dueTasks = this.getDueTasks();
      if (dueTasks.length > 0) {
        content.appendChild(this.buildSection("DUE_TASKS", dueTasks));
      }
  
      // Projects sections
      if (this.config.groupBy === "project") {
        const projects = this.getGroupedProjects();
        projects.forEach(project => {
          content.appendChild(this.buildProjectSection(project));
        });
      } else {
        // Other grouping methods
        content.appendChild(this.buildSection("ALL_TASKS", this.tasks));
      }
  
      wrapper.appendChild(content);
      return wrapper;
    },
  
    getDueTasks: function() {
      return this.tasks
        .filter(task => task.due)
        .sort((a, b) => moment(a.due.date).diff(moment(b.due.date)))
        .slice(0, this.config.dueTasksLimit);
    },
  
    getGroupedProjects: function() {
      const projectMap = {};
      
      this.tasks.forEach(task => {
        if (!task.due) {
          const projectId = task.project_id;
          if (!projectMap[projectId]) {
            projectMap[projectId] = {
              id: projectId,
              name: this.getProjectName(projectId),
              tasks: []
            };
          }
          projectMap[projectId].tasks.push(task);
        }
      });
  
      // Apply project limits
      return Object.values(projectMap)
        .filter(project => 
          this.config.projects.length === 0 || 
          this.config.projects.includes(project.id)
        )
        .map(project => ({
          ...project,
          tasks: project.tasks.slice(0, this.config.customProjectLimits[project.id] || this.config.maximumEntries)
        }));
    },
  
    getProjectName: function(projectId) {
      const project = this.projects.find(p => p.id === projectId);
      return project ? project.name : `Project ${projectId}`;
    },
  
    buildSection: function(titleKey, tasks) {
      const section = document.createElement("div");
      section.className = "todoist-section";
      
      const header = document.createElement("div");
      header.className = "section-header";
      header.textContent = this.translate(titleKey);
      section.appendChild(header);
  
      const taskList = document.createElement("div");
      taskList.className = "task-list";
      tasks.forEach(task => taskList.appendChild(this.buildTaskElement(task)));
      section.appendChild(taskList);
  
      return section;
    },
  
    buildProjectSection: function(project) {
      const section = document.createElement("div");
      section.className = "todoist-section project-section";
      
      // Project header
      const header = document.createElement("div");
      header.className = "project-header";
      header.innerHTML = `
        <div class="project-name">${project.name}</div>
        <div class="project-task-count">${project.tasks.length} ${this.translate("TASKS")}</div>
      `;
      section.appendChild(header);
  
      // Divider
      if (this.config.showDividers) {
        const divider = document.createElement("div");
        divider.className = "project-divider";
        section.appendChild(divider);
      }
  
      // Tasks
      const taskList = document.createElement("div");
      taskList.className = "task-list";
      project.tasks.forEach(task => taskList.appendChild(this.buildTaskElement(task)));
      section.appendChild(taskList);
  
      return section;
    },
  
    buildTaskElement: function(task) {
      const taskEl = document.createElement("div");
      taskEl.className = `task ${task.priority > 1 ? `priority-${task.priority}` : ""}`;
      
      // Avatar
      if (this.config.showAvatars && task.responsible_uid) {
        const avatar = document.createElement("img");
        avatar.className = "task-avatar";
        avatar.src = `https://todoist.com/api/${this.config.apiVersion}/users/${task.responsible_uid}/avatar`;
        avatar.onerror = () => avatar.style.display = "none";
        taskEl.appendChild(avatar);
      }
  
      // Content
      const content = document.createElement("div");
      content.className = "task-content";
      
      // Priority
      if (this.config.showPriority && task.priority > 1) {
        const priority = document.createElement("div");
        priority.className = "task-priority";
        priority.innerHTML = `<i class="fas fa-exclamation-circle"></i>`;
        content.appendChild(priority);
      }
  
      // Text
      const text = document.createElement("div");
      text.className = "task-text";
      text.textContent = task.content;
      content.appendChild(text);
  
      // Due date
      if (task.due) {
        const due = document.createElement("div");
        due.className = "task-due";
        
        const dueDate = moment(task.due.date);
        let dueText = dueDate.format(this.config.dateFormat);
        
        if (dueDate.isSame(moment(), 'day')) {
          dueText = this.translate("TODAY");
          due.classList.add("due-today");
        } else if (dueDate.isSame(moment().add(1, 'days'), 'day')) {
          dueText = this.translate("TOMORROW");
        } else if (dueDate.isBefore(moment(), 'day')) {
          dueText = this.translate("OVERDUE");
          due.classList.add("due-overdue");
        }
        
        due.textContent = dueText;
        content.appendChild(due);
      }
  
      taskEl.appendChild(content);
      return taskEl;
    },
  
    scheduleUpdate: function() {
      // Set up recurring updates with the full payload
      this.updateTimer = setInterval(() => {
        this.sendSocketNotification("UPDATE_TASKS", {
          identifier: this.identifier
        });
      }, this.config.updateInterval);
      
      // Do an immediate update after 1 second
      setTimeout(() => {
        this.sendSocketNotification("UPDATE_TASKS", {
          identifier: this.identifier
        });
      }, 1000);
    },
  
    socketNotificationReceived: function(notification, payload) {
      if (payload && payload.instanceId && payload.instanceId !== this.identifier) {
        // Skip notifications meant for other instances
        return;
      }
      
      switch (notification) {
        case "TASKS_UPDATED":
        case "TODOIST_TASKS":
          this.tasks = payload.tasks || [];
          this.projects = payload.projects || [];
          this.loaded = true;
          this.error = null;
          this.lastUpdated = new Date();
          this.updateDom(this.config.fadeSpeed);
          break;
          
        case "TASKS_ERROR":
        case "TODOIST_ERROR":
          this.error = payload.error;
          this.updateDom(this.config.fadeSpeed);
          break;
      }
    }
  });