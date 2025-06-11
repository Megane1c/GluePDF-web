# GluePDF Web

A lightweight PDF merging tool built with React, TypeScript, and Vite.

## Features
- Drag-and-drop PDF uploads (multi-select supported)
- Reorder files via intuitive drag-and-drop (powered by dnd-kit)
- Merge PDFs client-side (no server needed) using pdf-lib

## Getting Started

1. **Prerequisites:**  
   - Node.js (v16+ recommended)
   - npm

2. **Clone the repository:**
   ```bash
   https://github.com/Megane1c/GluePDF-web.git
   cd gluepdf
   ```

2. **Setup:**  
   ```bash
   npm install
   npm run dev
   ```

The server will start on port 5173 by default.

## Key Code Highlights
- `pdf.ts`: Handles PDF validation, storage, and merging.
- `PDFMerger.tsx`: Manages drag-and-drop, merge workflow, and error states.
- `PDFList.tsx`: Optimized sortable list with filename truncation and size formatting.

## Project Structure
- `public/` - Static assets
- `src/` - Main application source code
- `src/components/` - UI/UX and PDF list handler
- `src/services/` - PDF processing logic (merge, validation, sign)
- `App.tsx` - Root component
- `main.tsx` - React + Vite entry point
- `App.css`, `index.css` - Component and global styles
- `index.html` - HTML template used by Vite
- `README.md` - Project documentation (this file)