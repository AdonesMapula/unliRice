# Seed Firebase with random data

Populates your Firebase project (Auth + Firestore) with random officers, drivers, vehicle owners, vehicles, and authorizations.

## Setup

1. **Service account key**
   - Firebase Console → Project Settings → Service accounts
   - Click **Generate new private key**
   - Save the JSON file as **`firebase-admin.json`** in the **project root** (same folder as `package.json`)

   Do **not** commit this file. It is listed in `.gitignore` (e.g. `src/seeding/firebase-admin.json` or `firebase-admin.json`).

2. **Project ID**  
   The script uses the project ID from your app (`valicheck-21c70`). If your app uses a different project, edit `PROJECT_ID` in `scripts/seed-firebase.cjs`.

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
