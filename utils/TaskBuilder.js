/*
 * MMM-StylishTodoist
 * MIT license
 *
 * DOM Builder for the stylish Todoist tasks
 */

/* eslint-disable no-undef */

class TaskBuilder {
    constructor(translator, config) {
      this.translate = translator;
      this.config = config;
      this.root = document.querySelector(":root");
      
      // SVG icon paths
      this.svgs = {
        task: "M19,3H5C3.89,3 3,3.89 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5C21,3.89 20.1,3 19,3M19,5V19H5V5H19Z",
        check: "M21,7L9,19L3.5,13.5L4.91,12.09L9,16.17L19.59,5.59L21,7Z",
        clock: "M12,20A8,8 0 0,0 20,12A8,8 0 0,0 12,4A8,8 0 0,0 4,12A8,8 0 0,0 12,20M12,2A10,10 0 0,1 22,12A10,10 0 0,1 12,22C6.47,22 2,17.5 2,12A10,10 0 0,1 12,2M12.5,7V12.25L17,14.92L16.25,16.15L11,13V7H12.5Z",
        priority: "M5,3H19A2,2 0 0,1 21,5V19A2,2 0 0,1 19,21H5A2,2 0 0,1 3,19V5A2,2 0 0,1 5,3M12,10A2,2 0 0,0 10,12A2,2 0 0,0 12,14A2,2 0 0,0 14,12A2,2 0 0,0 12,10Z",
        project: "M5,13H19V11H5M3,17H17V15H3M7,7V9H21V7",
        label: "M17.63,5.84C17.27,5.33 16.67,5 16,5H5A2,2 0 0,0 3,7V17A2,2 0 0,0 5,19H16C16.67,19 17.27,18.66 17.63,18.15L22,12L17.63,5.84Z",
        user: "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z",
        work: "M10,2H14A2,2 0 0,1 16,4V6H20A2,2 0 0,1 22,8V19A2,2 0 0,1 20,21H4C2.89,21 2,20.1 2,19V8C2,6.89 2.89,6 4,6H8V4C8,2.89 8.89,2 10,2M14,6V4H10V6H14Z",
        family: "M12,5.5A3.5,3.5 0 0,1 15.5,9A3.5,3.5 0 0,1 12,12.5A3.5,3.5 0 0,1 8.5,9A3.5,3.5 0 0,1 12,5.5M5,8C5.56,8 6.08,8.15 6.53,8.42C6.38,9.85 6.8,11.27 7.66,12.38C7.16,13.34 6.16,14 5,14A3,3 0 0,1 2,11A3,3 0 0,1 5,8M19,8A3,3 0 0,1 22,11A3,3 0 0,1 19,14C17.84,14 16.84,13.34 16.34,12.38C17.2,11.27 17.62,9.85 17.47,8.42C17.92,8.15 18.44,8 19,8M5.5,18.25C5.5,16.18 8.41,14.5 12,14.5C15.59,14.5 18.5,16.18 18.5,18.25V20H5.5V18.25M0,20V18.5C0,17.11 1.89,15.94 4.45,15.6C3.86,16.28 3.5,17.22 3.5,18.25V20H0M24,20H20.5V18.25C20.5,17.22 20.14,16.28 19.55,15.6C22.11,15.94 24,17.11 24,18.5V20Z",
        personal: "M12,4A4,4 0 0,1 16,8A4,4 0 0,1 12,12A4,4 0 0,1 8,8A4,4 0 0,1 12,4M12,14C16.42,14 20,15.79 20,18V20H4V18C4,15.79 7.58,14 12,14Z"
      };
      
      // Colors palette for priorities
      this.priorityColors = {
        1: "#ff5252", // Priority 1 - High (red)
        2: "#ffc107", // Priority 2 - Medium (amber)
        3: "#4caf50", // Priority 3 - Low (green)
        4: "#9e9e9e"  // Priority 4 - No priority (gray)
      };
    }
  
    buildTaskList(tasks, config) {
      const container = document.createElement("div");
      container.className = "todoist-container";
      
      // Add header if enabled
      if (config.showHeader) {
        container.appendChild(this.buildHeader());
      }
      
      // Group by date, project, or none based on config
      if (config.groupBy === "project") {
        container.appendChild(this.buildProjectGroupedView(tasks));
      } else if (config.groupBy === "priority") {
        container.appendChild(this.buildPriorityGroupedView(tasks));
      } else if (config.groupBy === "date") {
        container.appendChild(this.buildDateGroupedView(tasks));
      } else {
        // No grouping, just list all tasks
        container.appendChild(this.buildFlatTaskList(tasks));
      }
      
      // Add legend showing projects
      if (config.showLegend !== false && tasks.length > 0) {
        container.appendChild(this.buildProjectLegend(tasks));
      }
      
      return container;
    }
    
    buildHeader() {
      const header = document.createElement("div");
      header.className = "todoist-header";
      
      const title = document.createElement("div");
      title.className = "todoist-title";
      
      // Add icon
      const iconContainer = document.createElement("div");
      iconContainer.className = "todoist-icon";
      
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.setAttribute("viewBox", "0 0 24 24");
      
      const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
      path.setAttribute("d", this.svgs.task);
      path.setAttribute("fill", "currentColor");
      
      svg.appendChild(path);
      iconContainer.appendChild(svg);
      
      // Add title
      const titleText = document.createElement("span");
      titleText.textContent = this.translate("TASKS") || "Todoist";
      
      title.appendChild(iconContainer);
      title.appendChild(titleText);
      
      header.appendChild(title);
      
      return header;
    }
    
    buildFlatTaskList(tasks) {
      const container = document.createElement("div");
      container.className = "todoist-tasks-view";
      
      // Add each task
      tasks.forEach(task => {
        const taskElement = this.buildTaskElement(task);
        container.appendChild(taskElement);
      });
      
      return container;
    }
    
    buildDateGroupedView(tasks) {
      const container = document.createElement("div");
      container.className = "todoist-date-view";
      
      // Group tasks by due date
      const tasksByDate = this.groupTasksByDate(tasks);
      const dayLimit = this.config.dayLimit || 7;
      let daysAdded = 0;
      
      // Add each day group
      for (const [day, dayTasks] of Object.entries(tasksByDate)) {
        if (daysAdded >= dayLimit) break;
        
        const dayContainer = this.buildDayGroup(day, dayTasks);
        container.appendChild(dayContainer);
        daysAdded++;
      }
      
      return container;
    }
    
    buildProjectGroupedView(tasks) {
      const container = document.createElement("div");
      container.className = "todoist-project-view";
      
      // Group tasks by project
      const tasksByProject = this.groupTasksByProject(tasks);
      
      // Add each project group
      for (const [projectId, projectTasks] of Object.entries(tasksByProject)) {
        // Skip if no tasks
        if (projectTasks.length === 0) continue;
        
        const projectContainer = this.buildProjectGroup(projectId, projectTasks);
        container.appendChild(projectContainer);
      }
      
      return container;
    }
    
    buildPriorityGroupedView(tasks) {
      const container = document.createElement("div");
      container.className = "todoist-priority-view";
      
      // Group tasks by priority
      const tasksByPriority = this.groupTasksByPriority(tasks);
      
      // Add priority groups in order (highest first)
      for (let priority = 1; priority <= 4; priority++) {
        const priorityTasks = tasksByPriority[priority] || [];
        
        // Skip if no tasks
        if (priorityTasks.length === 0) continue;
        
        const priorityContainer = this.buildPriorityGroup(priority, priorityTasks);
        container.appendChild(priorityContainer);
      }
      
      return container;
    }
    
    buildDayGroup(day, tasks) {
      const dayContainer = document.createElement("div");
      dayContainer.className = "todoist-day-group";
      
      // Add day header
      const dayHeader = document.createElement("div");
      dayHeader.className = "day-header";
      
      const dayName = document.createElement("div");
      dayName.className = "day-name";
      
      // Format the day in a more readable way
      let dayText = day;
      let dateText = "";
      
      if (day === "overdue") {
        dayName.textContent = this.translate("OVERDUE") || "Overdue";
        dayName.classList.add("overdue");
      } else if (day === "nodate") {
        dayName.textContent = this.translate("NO_DATE") || "No Due Date";
      } else {
        // Format the date
        const dayDate = moment(day, "YYYY-MM-DD");
        const isToday = dayDate.isSame(moment(), "day");
        
        if (isToday) {
          dayName.textContent = this.translate("TODAY") || "Today";
          dayName.classList.add("today");
        } else if (dayDate.isSame(moment().add(1, "day"), "day")) {
          dayName.textContent = this.translate("TOMORROW") || "Tomorrow";
        } else {
          dayName.textContent = dayDate.format("dddd");
        }
        
        const dayDateElement = document.createElement("div");
        dayDateElement.className = "day-date";
        dayDateElement.textContent = dayDate.format(this.config.dateFormat);
        dayHeader.appendChild(dayDateElement);
      }
      
      dayHeader.appendChild(dayName);
      dayContainer.appendChild(dayHeader);
      
      // Add tasks for this day
      const dayTasks = document.createElement("div");
      dayTasks.className = "day-tasks";
      
      tasks.forEach(task => {
        const taskElement = this.buildTaskElement(task);
        dayTasks.appendChild(taskElement);
      });
      
      dayContainer.appendChild(dayTasks);
      return dayContainer;
    }
    
    buildProjectGroup(projectId, tasks) {
      // All tasks in this group should have the same project
      const firstTask = tasks[0];
      
      const projectContainer = document.createElement("div");
      projectContainer.className = "todoist-project-group";
      
      // Add project header
      const projectHeader = document.createElement("div");
      projectHeader.className = "project-header";
      
      const projectName = document.createElement("div");
      projectName.className = "project-name";
      projectName.textContent = firstTask.projectName || "Unknown Project";
      
      // Add color indicator
      if (this.config.colorizeByProject && firstTask.projectColor) {
        const color = this.getTodoistColor(firstTask.projectColor);
        projectName.style.color = color;
        projectContainer.style.setProperty("--project-color", color);
      }
      
      projectHeader.appendChild(projectName);
      projectContainer.appendChild(projectHeader);
      
      // Add tasks for this project
      const projectTasks = document.createElement("div");
      projectTasks.className = "project-tasks";
      
      tasks.forEach(task => {
        const taskElement = this.buildTaskElement(task);
        projectTasks.appendChild(taskElement);
      });
      
      projectContainer.appendChild(projectTasks);
      return projectContainer;
    }
    
    buildPriorityGroup(priority, tasks) {
      const priorityContainer = document.createElement("div");
      priorityContainer.className = "todoist-priority-group";
      
      // Add priority header
      const priorityHeader = document.createElement("div");
      priorityHeader.className = "priority-header";
      
      const priorityName = document.createElement("div");
      priorityName.className = "priority-name";
      
      // Set text based on priority level
      let priorityText;
      switch (priority) {
        case 1:
          priorityText = this.translate("PRIORITY_1") || "Priority 1 (High)";
          break;
        case 2:
          priorityText = this.translate("PRIORITY_2") || "Priority 2 (Medium)";
          break;
        case 3:
          priorityText = this.translate("PRIORITY_3") || "Priority 3 (Low)";
          break;
        case 4:
          priorityText = this.translate("PRIORITY_4") || "Priority 4 (None)";
          break;
      }
      
      priorityName.textContent = priorityText;
      
      // Set color based on priority
      const priorityColor = this.priorityColors[priority];
      priorityName.style.color = priorityColor;
      priorityContainer.style.setProperty("--priority-color", priorityColor);
      
      priorityHeader.appendChild(priorityName);
      priorityContainer.appendChild(priorityHeader);
      
      // Add tasks for this priority
      const priorityTasks = document.createElement("div");
      priorityTasks.className = "priority-tasks";
      
      tasks.forEach(task => {
        const taskElement = this.buildTaskElement(task);
        priorityTasks.appendChild(taskElement);
      });
      
      priorityContainer.appendChild(priorityTasks);
      return priorityContainer;
    }
    
    buildTaskElement(task) {
      const taskElement = document.createElement("div");
      taskElement.className = "todoist-task";
      
      // Add color coding based on project or priority
      if (this.config.colorizeByProject && task.projectColor) {
        taskElement.style.setProperty("--task-color", this.getTodoistColor(task.projectColor));
      } else {
        // Default to priority colors
        const priorityColor = this.priorityColors[task.priority] || this.priorityColors[4];
        taskElement.style.setProperty("--task-color", priorityColor);
      }
      
      // Add account symbol/icon
      if (this.config.displaySymbol) {
        const symbolContainer = document.createElement("div");
        symbolContainer.className = "task-symbol";
        
        // Get the account symbol or default
        const symbol = task.accountSymbol || this.config.defaultSymbol;
      
        // Create the icon
        symbolContainer.appendChild(this.createIcon(symbol, task.accountColor));
        
        taskElement.appendChild(symbolContainer);
      }
      
      // Add priority indicator for priority 1-3
      if (task.priority < 4) {
        const priorityIndicator = document.createElement("div");
        priorityIndicator.className = "task-priority";
        priorityIndicator.style.backgroundColor = this.priorityColors[task.priority];
        
        // Add priority number
        const priorityNumber = document.createElement("span");
        priorityNumber.textContent = task.priority;
        priorityIndicator.appendChild(priorityNumber);
        
        taskElement.appendChild(priorityIndicator);
      }
      
      // Add due date if available and enabled
      if (this.config.showDueDate && task.due) {
        const dueDate = document.createElement("div");
        dueDate.className = "task-due-date";
        
        // Check if overdue
        const isOverdue = moment(task.due.date).isBefore(moment(), 'day');
        if (isOverdue) {
          dueDate.classList.add("overdue");
        }
        
        // Format the date
        let dateText;
        const dueDateTime = moment(task.due.date);
        const isToday = dueDateTime.isSame(moment(), 'day');
        const isTomorrow = dueDateTime.isSame(moment().add(1, 'day'), 'day');
        
        if (isToday) {
          dateText = this.translate("TODAY") || "Today";
        } else if (isTomorrow) {
          dateText = this.translate("TOMORROW") || "Tomorrow";
        } else {
          dateText = dueDateTime.format(this.config.dateFormat);
        }
        
        // Show time if available
        if (task.due.datetime) {
          const timeFormat = this.config.timeFormat === 24 ? "HH:mm" : "h:mm A";
          dateText += ` ${moment(task.due.datetime).format(timeFormat)}`;
        }
        
        dueDate.textContent = dateText;
        taskElement.appendChild(dueDate);
      }
      
      // Create content wrapper
      const contentWrapper = document.createElement("div");
      contentWrapper.className = "task-content";
      
      // Add task title
      const title = document.createElement("div");
      title.className = "task-title";
      
      // Truncate title if needed
      let titleText = task.content;
      if (titleText.length > this.config.maxTitleLength) {
        titleText = titleText.substring(0, this.config.maxTitleLength) + "...";
      }
      
      title.textContent = titleText;
      contentWrapper.appendChild(title);
      
      // Add project name if enabled
      if (this.config.showProject && task.projectName) {
        const project = document.createElement("div");
        project.className = "task-project";
        
        // Create project icon
        const projectIcon = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        projectIcon.setAttribute("viewBox", "0 0 24 24");
        projectIcon.classList.add("project-icon");
        
        const projectPath = document.createElementNS("http://www.w3.org/2000/svg", "path");
        projectPath.setAttribute("d", this.svgs.project);
        projectPath.setAttribute("fill", "currentColor");
        
        projectIcon.appendChild(projectPath);
        
        project.appendChild(projectIcon);
        project.appendChild(document.createTextNode(task.projectName));
        
        if (this.config.colorizeByProject && task.projectColor) {
          project.style.color = this.getTodoistColor(task.projectColor);
        }
        
        contentWrapper.appendChild(project);
      }
      
      // Add description if available and enabled
      if (this.config.showDescription && task.description) {
        const description = document.createElement("div");
        description.className = "task-description";
        description.textContent = task.description.substring(0, 50) + (task.description.length > 50 ? "..." : "");
        contentWrapper.appendChild(description);
      }
      
      taskElement.appendChild(contentWrapper);
      return taskElement;
    }
    
    buildProjectLegend(tasks) {
      // Create unique map of projects
      const projectMap = new Map();
      
      tasks.forEach(task => {
        if (task.projectId && task.projectName) {
          projectMap.set(task.projectId, {
            name: task.projectName,
            color: task.projectColor
          });
        }
      });
      
      // If no projects found, don't show legend
      if (projectMap.size === 0) {
        return document.createElement("div");
      }
      
      // Create legend container
      const legendContainer = document.createElement("div");
      legendContainer.className = "todoist-legend";
      
      // Add legend title
      const legendTitle = document.createElement("div");
      legendTitle.className = "legend-title";
      legendTitle.textContent = this.translate("PROJECTS") || "Projects";
      legendContainer.appendChild(legendTitle);
      
      // Create legend items
      const legendItems = document.createElement("div");
      legendItems.className = "legend-items";
      
      // Add each project to the legend
      projectMap.forEach((details, projectId) => {
        const legendItem = document.createElement("div");
        legendItem.className = "legend-item";
        
        // Add color indicator
        const colorIndicator = document.createElement("div");
        colorIndicator.className = "legend-color";
        colorIndicator.style.backgroundColor = this.getTodoistColor(details.color);
        legendItem.appendChild(colorIndicator);
        
        // Add name
        const nameContainer = document.createElement("div");
        nameContainer.className = "legend-name";
        nameContainer.textContent = details.name;
        legendItem.appendChild(nameContainer);
        
        legendItems.appendChild(legendItem);
      });
      
      legendContainer.appendChild(legendItems);
      return legendContainer;
    }
    
    // Helper method to create icon elements based on icon type
    createIcon(symbol, color) {
      // Check if this is a FontAwesome icon (fa: prefix)
      if (symbol && symbol.startsWith('fa:')) {
        // Extract FontAwesome icon name
        const faIcon = symbol.substring(3);
        const icon = document.createElement('i');
        icon.className = faIcon;
        if (color) {
          icon.style.color = color;
        }
        return icon;
      }
      // Use built-in SVG icon replacement if available
      else if (this.svgs[symbol]) {
        const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
        svg.setAttribute("viewBox", "0 0 24 24");
        
        const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
        path.setAttribute("d", this.svgs[symbol]);
        path.setAttribute("fill", "currentColor");
        
        svg.appendChild(path);
        return svg;
      } else {
        // Default text fallback
        const span = document.createElement('span');
        span.textContent = symbol || "•";
        return span;
      }
    }
    
    // Helper methods
    groupTasksByDate(tasks) {
      const tasksByDate = {
        "overdue": [],
        "nodate": []
      };
      
      const today = moment().format("YYYY-MM-DD");
      
      tasks.forEach(task => {
        if (!task.due) {
          // Tasks with no due date
          tasksByDate["nodate"].push(task);
        } else {
          const dueDate = moment(task.due.date).format("YYYY-MM-DD");
          
          // Check if overdue
          if (moment(dueDate).isBefore(today) && !task.completed) {
            tasksByDate["overdue"].push(task);
          } else {
            // Group by due date
            if (!tasksByDate[dueDate]) {
              tasksByDate[dueDate] = [];
            }
            
            tasksByDate[dueDate].push(task);
          }
        }
      });
      
      return tasksByDate;
    }
    
    groupTasksByProject(tasks) {
      const tasksByProject = {};
      
      tasks.forEach(task => {
        const projectId = task.project_id || "no_project";
        
        if (!tasksByProject[projectId]) {
          tasksByProject[projectId] = [];
        }
        
        tasksByProject[projectId].push(task);
      });
      
      return tasksByProject;
    }
    
    groupTasksByPriority(tasks) {
      const tasksByPriority = {
        1: [],
        2: [],
        3: [],
        4: []
      };
      
      tasks.forEach(task => {
        const priority = task.priority || 4;
        tasksByPriority[priority].push(task);
      });
      
      return tasksByPriority;
    }
    
    // Convert Todoist color name to hex color
    getTodoistColor(colorName) {
      const colorMap = {
        "berry_red": "#b8256f",
        "red": "#db4035",
        "orange": "#ff9933",
        "yellow": "#fad000",
        "olive_green": "#afb83b",
        "lime_green": "#7ecc49",
        "green": "#299438",
        "mint_green": "#6accbc",
        "teal": "#158fad",
        "sky_blue": "#14aaf5",
        "light_blue": "#96c3eb",
        "blue": "#4073ff",
        "grape": "#884dff",
        "violet": "#af38eb",
        "lavender": "#eb96eb",
        "magenta": "#e05194",
        "salmon": "#ff8d85",
        "charcoal": "#808080",
        "grey": "#b8b8b8",
        "taupe": "#ccac93"
      };
      
      return colorMap[colorName] || this.config.themeColor;
    }
}