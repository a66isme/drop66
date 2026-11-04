# drop66

Send files between your computer and phone on the same Wi-Fi. Scan a code, no app.

## Run it on your computer

1. Install Node.js (version 18 or newer) from nodejs.org.
2. Open a terminal in this folder.
3. Run: `npm install`
4. Run: `npm start`
5. Open `http://YOUR-COMPUTER-IP:3000` in the computer's browser.
   (Find your IP: Windows `ipconfig`, Mac `ipconfig getifaddr en0`.
   Do NOT use `localhost`, because the QR code would point your phone to its own localhost.)
6. Scan the QR code with your phone's camera.

## Put it online

Any Node host works (Render, Railway, Fly.io). Set the start command to `npm start`.
The host gives you an https link. Open it on the computer and scan.
