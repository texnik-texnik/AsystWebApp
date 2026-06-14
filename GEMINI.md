# Assistant Web (PWA Quiz App) - Project Instructions

This project is a modern, offline-first Progressive Web App (PWA) designed for exam preparation. It transforms simple text files into interactive quiz modules.

## Project Overview

*   **Purpose:** Provide a lightweight, offline-capable tool for studying and taking practice exams.
*   **Main Technologies:**
    *   **Frontend:** Vanilla HTML5, CSS3, and JavaScript (ES6+).
    *   **Storage:** IndexedDB API for persistent local storage of tests, progress, and high scores.
    *   **PWA:** Service Workers (`sw.js`) for resource caching and Web Manifest (`manifest.json`) for "Add to Home Screen" support.
*   **Architecture:** Single-page application (SPA) style with screen switching handled in `app.js`. Logic is partitioned into sections: DB setup, parsing, catalog management, quiz modes, and UI interactions.

## Key Files

*   `index.html`: The main entry point and UI structure.
*   `app.js`: Core application logic, IndexedDB management, and test parsing.
*   `styles.css`: Responsive styling and theme definitions (light/dark).
*   `sw.js`: Service Worker for offline functionality and asset caching.
*   `manifest.json`: PWA metadata.
*   `dino.js`: Logic for the built-in "Dino Game" easter egg.
*   `create_icon.js`: Utility script to generate the project's `icon.svg`.

## Building and Running

### Development Server
Since the app uses Service Workers and IndexedDB, it should be served over HTTP(S).
*   **Python:** `python3 -m http.server 8081`
*   **Node.js:** `npx serve .`
*   **Direct Access:** Open `http://localhost:8081` in your browser.

### Icon Generation
If the icon needs to be updated:
*   `node create_icon.js`

### Testing
*   No automated test suite is currently implemented.
*   **Manual Validation:** Verify changes by refreshing the app in a browser. Note that Service Worker updates may require "Update on reload" or clearing the cache in DevTools.

## Development Conventions

*   **Vanilla JS:** Maintain the zero-dependency philosophy. Do not add external frameworks or libraries unless explicitly requested.
*   **Offline-First:** All features must be functional without an internet connection.
*   **Mobile-First UI:** Ensure all UI elements are touch-friendly and responsive.
*   **Parsing Logic:** The parser in `app.js` (`parseTestContent`) is sensitive to the `?`, `+`, `-` format. Any changes to the parser should be thoroughly tested with various text file inputs.
*   **IndexedDB Schema:** The `tests` store uses `name` as the `keyPath`. Ensure data consistency when modifying the stored object structure.
*   **Tactile Feedback:** Use `navigator.vibrate` for critical interactions (correct/wrong answers) to enhance the user experience on mobile.

## TODOs
- [ ] Implement automated unit tests for the parser.
- [ ] Add support for image attachments in questions.
- [ ] Implement more advanced statistics/analytics.
