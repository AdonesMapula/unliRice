# Firebase seeding

To run the seed script (`npm run seed`), the script needs a **Firebase service account key**.

1. In [Firebase Console](https://console.firebase.google.com), open your project.
2. Go to **Project settings** (gear) → **Service accounts**.
3. Click **Generate new private key** and download the JSON file.
4. Do one of the following:
   - Save the file as **`firebase-admin.json`** in the **project root** (folder that contains `package.json`), or
   - Save it here as **`firebase-admin.json`** (this folder), or
   - Save it anywhere and run:  
     **Windows:** `set GOOGLE_APPLICATION_CREDENTIALS=C:\path\to\your-key.json` then `npm run seed`  
     **Or:** `npm run seed -- "C:\path\to\your-key.json"`

**Do not commit the key file.** It is listed in `.gitignore`.
