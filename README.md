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

## Einrichtung deiner Todoist-Konten

Sobald das Modul installiert ist und dein MagicMirror läuft:

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
   - Deinen Todoist API-Token eingeben (du findest diesen in den Todoist-Einstellungen unter "Integrationen")

4. Klicke auf "Konto hinzufügen". Das Konto wird automatisch zu deinem MagicMirror hinzugefügt.

5. Im Tab "Konten verwalten" kannst du:
   - Die hinzugefügten Konten anzeigen
   - Konten bearbeiten oder löschen

6. Im Tab "Einstellungen" kannst du:
   - Die maximale Anzahl der anzuzeigenden Aufgaben festlegen

7. Wiederhole den Vorgang für alle Konten, die du hinzufügen möchtest.

## Wie du deinen Todoist API-Token findest:

1. Melde dich bei Todoist an
2. Gehe zu Einstellungen → Integrationen
3. Scrolle nach unten zum Abschnitt "API token"
4. Kopiere den Token und füge ihn im Setup-Assistenten ein

## Anpassungsmöglichkeiten

Du kannst das Modul über folgende Konfigurationsoptionen in der `config.js` anpassen:

```javascript
{
    module: "MMM-StylishTodoist",
    position: "top_right",
    config: {
        // Todoist-Konfiguration
        maximumEntries: 10,            // Maximale Anzahl anzuzeigender Aufgaben
        groupBy: "date",               // Gruppierungsmodus: "date", "project", "priority", "none"
        sortType: "date",              // Sortierung: "date", "priority", "project"
        showCompleted: false,          // Zeige erledigte Aufgaben
        showOverdue: true,             // Zeige überfällige Aufgaben
        
        // Visuelle Anpassungen
        themeColor: "#e84c3d",         // Hauptakzentfarbe
        colorizeByProject: true,       // Farben für Aufgaben basierend auf Projekt anwenden
        roundedCorners: true,          // Abgerundete Ecken für UI-Elemente 
        showHeader: true,              // Header anzeigen
        
        // Aufgaben-Details
        showDueDate: true,             // Fälligkeitsdatum anzeigen
        showDescription: false,        // Aufgabenbeschreibungen anzeigen
        showProject: true,             // Projektnamen anzeigen
        
        // Animationen
        animateIn: true,               // Animation beim Anzeigen von Aufgaben
        fadeAnimations: true,          // Fade-Animationen
        textAnimations: true,          // Text-Animationen
        
        // Weitere Optionen
        language: config.language,     // Modulsprache (Standardmäßig Systemsprache)
        dateFormat: "MMM Do",          // Format für Datumsanzeige
        dayLimit: 7,                   // Maximale Anzahl anzuzeigender Tage (wenn groupBy: "date")
        showLegend: true,              // Legende mit Projekten anzeigen
    }
}
```

## Dateien und Struktur

Hier ist die Struktur des Moduls:

```
MMM-StylishTodoist/
├── MMM-StylishTodoist.js       # Hauptmodulskript
├── node_helper.js              # Node.js-Helfer für Backend-Operationen
├── package.json                # Paketinformationen und Abhängigkeiten
├── README.md                   # Dokumentation
├── css/
│   └── MMM-StylishTodoist.css  # Stylesheet für das Modul
├── public/
│   └── setup.html              # Setup-Assistent
├── translations/
│   ├── de.json                 # Deutsche Übersetzungen
│   └── en.json                 # Englische Übersetzungen
└── utils/
    └── TaskBuilder.js          # Helper für DOM-Erstellung
```

## Fehlerbehebung

Falls Probleme auftreten:

1. **Aufgaben werden nicht angezeigt:**
   - Überprüfe, ob dein API-Token korrekt ist
   - Stelle sicher, dass du überhaupt Aufgaben in deinem Todoist-Konto hast
   - Schaue in die MagicMirror Logs, um nach Fehlern zu suchen: `pm2 logs MagicMirror`

2. **Setup-Assistent ist nicht erreichbar:**
   - Stelle sicher, dass der Port 8080 nicht durch eine Firewall blockiert wird
   - Überprüfe, ob MagicMirror mit ausreichenden Rechten läuft

3. **Änderungen in Todoist werden nicht angezeigt:**
   - Das Modul aktualisiert sich standardmäßig alle 60 Sekunden
   - Änderungen bei Todoist können manchmal einige Zeit brauchen, bis sie über die API verfügbar sind

## Unterstützte Icon-Typen

Bei der Kontoeinrichtung kannst du aus folgenden Icons wählen:
- task (Aufgabe)
- user (Benutzer)
- work (Arbeit)
- family (Familie)
- personal (Persönlich)

## Unterstützte Kategorien

Vordefinierte Kategorien:
- Default
- Work (Arbeit)
- Family (Familie)
- Personal (Persönlich)

Du kannst auch eigene benutzerdefinierte Kategorien erstellen!