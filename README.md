# MMM-StylishTodoist - Installationsanleitung

Dieses Modul ist ein stilvolles, minimalistisches Todoist-Aufgabenmodul für MagicMirror² mit Multi-Account-Unterstützung. Es erlaubt dir, verschiedene Todoist-Konten mit benutzerdefinierten Kategorien (wie Arbeit, Familie etc.) zu verbinden und anzuzeigen.

## Installation

1. Navigiere zum Modulordner deines MagicMirror:
   ```bash
   cd ~/MagicMirror/modules
   ```

2. Klone das Repository:
   ```bash
   git clone https://github.com/yourusername/MMM-StylishTodoist.git
   ```

3. Installiere die Abhängigkeiten:
   ```bash
   cd MMM-StylishTodoist
   npm install
   ```

4. Füge das Modul zu deiner `config.js` Datei hinzu:
   ```javascript
   {
       module: "MMM-StylishTodoist",
       position: "top_right",
       config: {
           // WICHTIG: Trage deinen Todoist API-Token hier ein
           apiToken: "DEIN_TODOIST_API_TOKEN_HIER_EINFÜGEN",
           
           // Optional: Passe Konfigurationsoptionen an
           themeColor: "#e84c3d",
           groupBy: "date",
           dayLimit: 7
       }
   }
   ```

5. Starte MagicMirror neu:
   ```bash
   pm2 restart MagicMirror
   ```

## Wie du deinen Todoist API-Token findest:

1. Melde dich bei Todoist an
2. Gehe zu Einstellungen → Integrationen
3. Scrolle nach unten zum Abschnitt "API token"
4. Kopiere den Token und füge ihn in deine Konfiguration ein

## Optional: Einrichtung deiner Todoist-Konten über den Setup-Assistenten

Das Modul bietet auch einen Setup-Assistenten für eine erweiterte Konfiguration mit Multi-Account-Unterstützung:

1. Öffne einen Browser und gehe zu `http://DEINE-MIRROR-IP:8080/MMM-StylishTodoist/setup`
   (Wenn dein Mirror lokal läuft, kannst du auch `http://localhost:8080/MMM-StylishTodoist/setup` verwenden)

2. Alternativ kannst du im Modulverzeichnis folgenden Befehl ausführen, der dir den Link anzeigt:
   ```bash
   npm run setup
   ```

3. Im Setup-Assistenten kannst du:
   - Einen Namen für dein Todoist-Konto eingeben
   - Eine Kategorie auswählen (Arbeit, Familie, Persönlich, usw.)
   - Ein Symbol/Icon für das Konto wählen
   - Eine Farbe für das Konto festlegen
   - Deinen Todoist API-Token eingeben

4. Klicke auf "Konto hinzufügen". Das Konto wird automatisch zu deinem MagicMirror hinzugefügt.

## Anpassungsmöglichkeiten

Du kannst das Modul über folgende Konfigurationsoptionen in der `config.js` anpassen:

```javascript
{
    module: "MMM-StylishTodoist",
    position: "top_right",
    config: {
        // API-Konfiguration (erforderlich)
        apiToken: "DEIN_TODOIST_API_TOKEN",   // Dein Todoist API-Token (erforderlich!)
        
        // Allgemeine Konfiguration
        updateInterval: 10 * 60 * 1000,      // Aktualisierungsintervall (in ms, Standard: 10 Minuten)
        maximumEntries: 10,                  // Maximale Anzahl anzuzeigender Aufgaben
        fadeSpeed: 3000,                     // Geschwindigkeit der Überblendungseffekte
        
        // Gruppierungs- und Sortieroptionen
        groupBy: "date",                     // Gruppierungsmodus: "date", "project", "priority", "none"
        sortBy: "due_date",                  // Sortierung: "due_date", "priority", "project"
        showCompleted: false,                // Zeige erledigte Aufgaben
        showOverdue: true,                   // Zeige überfällige Aufgaben
        
        // Visuelle Anpassungen
        themeColor: "#e84c3d",               // Hauptakzentfarbe
        colorizeByProject: true,             // Farben für Aufgaben basierend auf Projekt anwenden
        showAvatars: true,                   // Benutzeravatare anzeigen
        showPriority: true,                  // Prioritätsanzeige einblenden
        showDividers: true,                  // Trennlinien zwischen Gruppen anzeigen
        
        // Aufgaben-Details
        showDueDate: true,                   // Fälligkeitsdatum anzeigen
        showProject: true,                   // Projektnamen anzeigen
        
        // Datum und Format
        dateFormat: "DD.MM.YYYY",            // Format für Datumsanzeige
        dayLimit: 7,                         // Maximale Anzahl anzuzeigender Tage (wenn groupBy: "date")
        dueTasksLimit: 7,                    // Maximale Anzahl fälliger Aufgaben
    }
}
```

## Fehlerbehebung

Falls Probleme auftreten:

1. **Aufgaben werden nicht angezeigt oder "Wird geladen..." wird ständig angezeigt:**
   - Überprüfe, ob du deinen API-Token in der Konfiguration angegeben hast
   - Stelle sicher, dass dein API-Token korrekt ist
   - Stelle sicher, dass du überhaupt Aufgaben in deinem Todoist-Konto hast
   - Schaue in die MagicMirror Logs, um nach Fehlern zu suchen: `pm2 logs MagicMirror`

2. **Setup-Assistent ist nicht erreichbar:**
   - Stelle sicher, dass der Port 8080 nicht durch eine Firewall blockiert wird
   - Überprüfe, ob MagicMirror mit ausreichenden Rechten läuft

3. **Änderungen in Todoist werden nicht angezeigt:**
   - Das Modul aktualisiert sich standardmäßig alle 10 Minuten
   - Du kannst das Aktualisierungsintervall durch Ändern von `updateInterval` in deiner Konfiguration anpassen

## Wichtig: API-Token-Konfiguration

**Der API-Token muss direkt in deiner MagicMirror `config.js` unter dem Modul-Konfigurationsabschnitt angegeben werden.**

Dies ist notwendig, damit das Modul auch ohne Zugriff auf den Setup-Assistenten funktioniert und kann nicht umgangen werden. Die grundlegende Funktionalität des Moduls erfordert diesen direkten API-Zugang.