# LTMS Officer App (Expo)

React Native officer scanner for LTMS QR verification. Officers sign in and scan driver QR codes at checkpoints.

## Run with Expo Go

1. Install dependencies:
   ```bash
   cd officer-app
   npm install
   ```

2. Start the dev server:
   ```bash
   npx expo start
   ```

3. Open the project in **Expo Go** on your phone:
   - Install **Expo Go** from the App Store (iOS) or Play Store (Android).
   - Scan the QR code shown in the terminal or browser with your phone camera (or use the “Run on Android device / iOS simulator” options if you have them set up).

4. Sign in with an **officer** account (same Firebase as the web app). Officers must have a document in the `officers` collection in Firestore for the signed-in user UID.

## Features

- Officer login (email/password; same Firebase as web).
- Enter vehicle plate number, then tap **Start QR Scan** to open the camera.
- Scan the driver’s QR code; the app verifies driver and vehicle and shows status (VALID / EXPIRED / UNAUTHORIZED / STOLEN).
- Enter **checkpoint address** and tap **Log traffic stop** to record the stop and notify the vehicle owner when the vehicle is borrowed/rented.
- **Mark STOLEN** / **Clear stolen** and **Log out**.

## Firebase

Uses the same Firebase project as the web app (`firebase.js`). Ensure the project’s Firestore and Auth are configured and that officer accounts exist in the `officers` collection.
