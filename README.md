# Photobooth React Kiosk

Framework version using:
- React
- Vite
- React Router
- Express
- Real image uploads stored in `server/uploads`
- JSON persistence in `server/data/templates.json`

## Core flow
Template → Subtemplate → Camera → 4–6 shots → choose favorites → Create Final Print → Print / Download

## Included
- Dynamic template categories
- Dynamic subtemplates
- Template cover image
- Subtemplate background image
- Transparent PNG overlay
- 4–6 shots
- User chooses final photos
- QR code embedded in the final print
- Final prints stored in `server/prints` and available from the QR code
- Selection order becomes print order
- 4:3 webcam request
- Mirrored live preview
- Unmirrored saved photo
- Live framing guide
- Photo Fit setting:
  - Fit entire photo — no crop
  - Fill slot — crop edges
- 1200×1800 (4×6) output
- Owner dashboard

## Removed for now
- Payments
- Cloud sync
- User accounts
- Manual crop/zoom
- Silent printer service

## Run in VS Code

1. Make sure Node.js LTS is installed:
   `node -v`
   `npm -v`

2. Open this project folder in VS Code.

3. In Terminal, run:
   `npm install`

4. Then:
   `cd client`
   `npm install`
   `cd ..`

5. Start both frontend and backend:
   `npm run dev`

6. Open:
   Kiosk: http://localhost:5173
   Admin: http://localhost:5173/admin

After creating a final print, scan its QR code to download the stored JPG. Prints are saved in `server/prints`.

## Test background/overlay
In Admin:
1. Open Studio.
2. Edit or create a subtemplate.
3. Upload Background Image.
4. Optional: upload transparent PNG as Overlay.
5. For no unexpected cropping, set Photo Fit to:
   `Fit entire photo — no crop`
6. Save.
7. Return to kiosk and select that subtemplate.

## Rendering order
1. Background
2. Selected photos
3. Transparent overlay

## Important
This is a development version. Browser printing still opens the print dialog.
For a real unattended kiosk, the next step is a Windows print service and kiosk auto-start/fullscreen.
