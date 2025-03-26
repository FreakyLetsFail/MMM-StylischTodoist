Module.register("MMM-StylishTodoist", {
    defaults: {
      apiKey: "",
      maxDueTasks: 5,
      showProjects: [],         // Leer = alle Projekte
      maxTasksPerProject: 10,   // Max. Tasks pro Projektabschnitt
      showAvatars: true,        // Avatare anzeigen
      avatarSize: "30px",
      dateFormat: "DD.MM.YYYY",
      fadeSpeed: 2000,
      updateInterval: 60 * 1000 // 1 Minute
    },
  
    requiresVersion: "2.1.0",
  
    start: function() {
      this.tasks = [];
      this.projects = [];
      this.loaded = false;
      this.error = null;
      
      this.sendSocketNotification("FETCH_TODOIST_DATA", {
        apiKey: this.config.apiKey
      });
      
      this.scheduleUpdate();
    },
  
    getStyles: function() {
      return ["MMM-StylishTodoist.css"];
    },
  
    getDom: function() {
      const wrapper = document.createElement("div");
      wrapper.className = "stylish-todoist";
  
      if (!this.loaded) {
        wrapper.innerHTML = this.error ? 
          `<div class="error">${this.error}</div>` : 
          `<div class="loading">Lade Aufgaben...</div>`;
        return wrapper;
      }
  
      if (this.tasks.length === 0) {
        wrapper.innerHTML = `<div class="empty">Keine Aufgaben gefunden</div>`;
        return wrapper;
      }
  
      // 1. Fällige Aufgaben (oben)
      const overdueTasks = this.getOverdueTasks();
      if (overdueTasks.length > 0) {
        const overdueSection = document.createElement("div");
        overdueSection.className = "overdue-section";
        overdueSection.innerHTML = `<h3><i class="fas fa-exclamation-circle"></i> Fällige Aufgaben</h3>`;
        
        overdueTasks.forEach(task => {
          overdueSection.appendChild(this.createTaskElement(task));
        });
        
        wrapper.appendChild(overdueSection);
      }
  
      // 2. Projekte gruppiert
      const groupedProjects = this.groupTasksByProject();
      groupedProjects.forEach(project => {
        if (this.config.showProjects.length > 0 && 
            !this.config.showProjects.includes(project.name)) {
          return;
        }
  
        const projectSection = document.createElement("div");
        projectSection.className = "project-section";
        
        projectSection.innerHTML = `
          <h3>${project.name}</h3>
          <div class="separator">___________________</div>
        `;
  
        project.tasks
          .slice(0, this.config.maxTasksPerProject)
          .forEach(task => {
            projectSection.appendChild(this.createTaskElement(task));
          });
  
        wrapper.appendChild(projectSection);
      });
  
      return wrapper;
    },
  
    socketNotificationReceived: function(notification, payload) {
      switch (notification) {
        case "TASKS_DATA":
          this.tasks = payload.tasks;
          this.projects = payload.projects;
          this.loaded = true;
          this.error = null;
          this.updateDom();
          break;
          
        case "FETCH_ERROR":
          this.error = payload.error || "Fehler beim Abruf der Daten";
          this.updateDom();
          break;
      }
    },
  
    scheduleUpdate: function() {
      setInterval(() => {
        this.sendSocketNotification("FETCH_TODOIST_DATA", {
          apiKey: this.config.apiKey
        });
      }, this.config.updateInterval);
    },
  
    getOverdueTasks: function() {
      return this.tasks
        .filter(task => task.due && moment(task.due.date).isBefore(moment()))
        .sort((a, b) => moment(a.due.date).diff(moment(b.due.date)))
        .slice(0, this.config.maxDueTasks);
    },
  
    groupTasksByProject: function() {
      const projectsMap = {};
      
      // Projekte initialisieren
      this.projects.forEach(project => {
        projectsMap[project.id] = {
          id: project.id,
          name: project.name,
          tasks: []
        };
      });
      
      // Tasks zu Projekten zuordnen
      this.tasks.forEach(task => {
        if (task.project_id && projectsMap[task.project_id]) {
          projectsMap[task.project_id].tasks.push(task);
        }
      });
      
      // Nach Projektnamen sortieren
      return Object.values(projectsMap)
        .filter(project => project.tasks.length > 0)
        .sort((a, b) => a.name.localeCompare(b.name));
    },
  
    createTaskElement: function(task) {
      const taskEl = document.createElement("div");
      taskEl.className = "task";
  
      // Avatar
      let avatarHtml = "";
      if (this.config.showAvatars && task.assignee && task.assignee.avatar_small) {
        avatarHtml = `
          <img src="${task.assignee.avatar_small}" 
               class="avatar" 
               style="width:${this.config.avatarSize}">
        `;
      }
  
      // Fälligkeitsdatum
      let dueDateHtml = "";
      if (task.due) {
        const isOverdue = moment(task.due.date).isBefore(moment());
        dueDateHtml = `
          <span class="due-date ${isOverdue ? "overdue" : ""}">
            | ${moment(task.due.date).format(this.config.dateFormat)}
          </span>
        `;
      }
  
      taskEl.innerHTML = `
        ${avatarHtml}
        <span class="content">${task.content}</span>
        ${dueDateHtml}
      `;
  
      return taskEl;
    }
  });