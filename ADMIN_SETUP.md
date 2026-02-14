# Admin Setup

## Default admin credentials

- **Username:** `LTOAdmin@ltms.gov.ph`
- **Password:** `admin123`

(On the login page, enter `LTOAdmin` as the username; the app signs in with `LTOAdmin@ltms.gov.ph`.)

## Creating the first admin

1. **Create a Firebase Auth user** (Firebase Console → Authentication → Add user):
   - Email: `LTOAdmin@ltms.gov.ph`
   - Password: `admin123`

2. **Add the admin to Firestore**:
   - Open Firestore in Firebase Console
   - Create a collection named `admins` (if it does not exist)
   - Add a document with **document ID = the user’s UID** (from Authentication)
   - You can set fields like `email` and `fullName` (optional); the app only checks that a document exists for that UID

After that, sign in at `/login` with username **LTOAdmin** and password **admin123**. You will be redirected to `/admin`.

## Email notifications for vehicle owners

When an officer logs a traffic stop for a **borrowed** or **rented** vehicle, a document is written to the `checkpointNotifications` collection. The vehicle owner sees these in the Owner dashboard.

To **send email** to the owner when their vehicle is stopped at a checkpoint, add a Firebase Cloud Function that:

1. Listens to `checkpointNotifications` (e.g. `onCreate`).
2. Reads `ownerEmail` and `checkpointAddress` from the document.
3. Sends an email (e.g. via SendGrid, Nodemailer, or Firebase Extensions).

## Firestore indexes

If you see an error when loading the Owner dashboard (e.g. "The query requires an index"), open the link in the error message to create the composite index for `checkpointNotifications` with fields `ownerId` (Ascending) and `createdAt` (Descending).
