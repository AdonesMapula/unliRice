# Seed Firebase with random data

Populates your Firebase project (Auth + Firestore) with random officers, drivers, vehicle owners, vehicles, and authorizations.

## Setup

1. **Service account key**
   - Firebase Console → Project Settings → Service accounts
   - Click **Generate new private key**
   - Save the JSON file as **`firebase-admin.json`** in the **project root** (same folder as `package.json`)

   Do **not** commit this file. It is listed in `.gitignore` (e.g. `src/seeding/firebase-admin.json` or `firebase-admin.json`).

2. **Same project as the app**  
   Use the service account key for the **same** Firebase project as your web and officer app (`valicheck-21c70`, see `src/firebase/config.js`). Otherwise seeded data will not show in the app and linking will break.

## Run

```bash
npm run seed
```

Or:

```bash
node scripts/seed-firebase.cjs
```

To use a key in another path:

```bash
GOOGLE_APPLICATION_CREDENTIALS=path/to/your-key.json node scripts/seed-firebase.cjs
```

## What gets created

- **3 officers** – Auth + `officers` (e.g. `officer1@ltms.gov.ph` / `password123`)
- **8 drivers** – Auth + `drivers` (email `...@fake.ltms.com`, password = last 6 digits of license)
- **3 vehicle owners** – Auth + `vehicleOwners`
- **12 vehicles** – Full fields (plate, chasis, file no, type, category, brand, color, owner, series, year, CR/OR), linked to drivers or owners
- **5 authorizations** – Borrowed vehicle links (driver ↔ plate)
- **5 scan logs** – Sample scan history

You can run the script more than once; it skips Auth users that already exist and may overwrite or add Firestore documents depending on IDs.
