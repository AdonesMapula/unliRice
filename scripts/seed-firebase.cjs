/**
 * Populate Firebase Auth + Firestore with random data.
 * Requires: Firebase Admin SDK service account key.
 *
 * 1. Download service account key from Firebase Console:
 *    Project Settings → Service accounts → Generate new private key
 * 2. Save as firebase-admin.json in project root (or set GOOGLE_APPLICATION_CREDENTIALS)
 * 3. Run: node scripts/seed-firebase.cjs
 *
 * Uses the project from your service account JSON. It MUST be the same project
 * as the web/officer app (valicheck-21c70, see src/firebase/config.js) so data
 * and linking work. Download the key from that project in Firebase Console.
 */

const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

const DEFAULT_PASSWORD = 'password123';

const NAMES = [
  'Juan Dela Cruz', 'Maria Santos', 'Roberto Garcia', 'Ana Reyes', 'Carlos Mendoza',
  'Elena Torres', 'Miguel Fernandez', 'Sofia Ramos', 'Jose Lopez', 'Carmen Diaz',
  'Antonio Cruz', 'Rosa Villanueva', 'Pedro Aquino', 'Teresa Bautista', 'Fernando Lim'
];

const OFFICER_NAMES = ['SPO4 Ramon Gutierrez', 'PO3 Liza Morales', 'SPO2 Edgar Santos', 'PO2 Nina Reyes'];

const STATIONS = ['Cebu City Checkpoint A', 'Manila EDSA', 'Davao Matina', 'Cagayan de Oro Divisoria'];

const PLATE_PREFIXES = ['ABC', 'NCA', 'XYZ', 'LTO', 'GMA', 'NAB', 'PDI', 'CDO', 'DAV'];
const VEHICLE_TYPES = ['Sedan', 'SUV', 'Van', 'Pickup', 'Motorcycle'];
const VEHICLE_CATEGORIES = ['Private', 'For Hire', 'Government'];
const BRANDS = ['Toyota', 'Honda', 'Mitsubishi', 'Nissan', 'Ford', 'Isuzu', 'Hyundai'];
const COLORS = ['White', 'Black', 'Silver', 'Red', 'Blue', 'Gray', 'Brown'];
const MODELS = ['Vios', 'Innova', 'Fortuner', 'Civic', 'City', 'Montero', 'Navara', 'Ranger', 'D-Max'];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}
function pickMany(arr, n) {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, n);
}
function randomYear() {
  return String(2018 + Math.floor(Math.random() * 7));
}
function randomPlate() {
  const prefix = pick(PLATE_PREFIXES);
  const num = String(1000 + Math.floor(Math.random() * 9000));
  return `${prefix} ${num}`;
}
function licenseNumber() {
  const a = String(10 + Math.floor(Math.random() * 90));
  const b = String(10 + Math.floor(Math.random() * 90));
  const c = String(100000 + Math.floor(Math.random() * 900000));
  return `D${a}-${b}-${c}`;
}
function futureDate() {
  const d = new Date();
  d.setFullYear(d.getFullYear() + 2 + Math.floor(Math.random() * 3));
  return d.toISOString().slice(0, 10);
}

function initAdmin() {
  const cwd = process.cwd();
  const rootKey = path.join(cwd, 'firebase-admin.json');
  const seedingKey = path.join(cwd, 'src', 'seeding', 'firebase-admin.json');
  const envKey = process.env.GOOGLE_APPLICATION_CREDENTIALS;
  const cliKey = process.argv[2] ? path.resolve(process.argv[2]) : null;

  let keyPath = cliKey || envKey || (fs.existsSync(rootKey) ? rootKey : null) || (fs.existsSync(seedingKey) ? seedingKey : null);

  if (!keyPath || !fs.existsSync(keyPath)) {
    console.error('Service account key not found.\n');
    console.error('Do one of the following:\n');
    console.error('  1. Download the key from Firebase Console:');
    console.error('     Project Settings → Service accounts → Generate new private key\n');
    console.error('  2. Save it as firebase-admin.json in the project root:');
    console.error('     ' + rootKey + '\n');
    console.error('  3. Or pass the path when running:');
    console.error('     npm run seed -- path/to/your-key.json\n');
    console.error('  4. Or set the environment variable:');
    console.error('     set GOOGLE_APPLICATION_CREDENTIALS=path\\to\\your-key.json   (Windows)');
    console.error('     export GOOGLE_APPLICATION_CREDENTIALS=path/to/your-key.json (Mac/Linux)\n');
    process.exit(1);
  }

  const key = require(keyPath);
  const expectedProject = 'valicheck-21c70';
  if (key.project_id) {
    console.log('Using project:', key.project_id);
    if (key.project_id !== expectedProject) {
      console.warn('Warning: App config uses project', expectedProject + '. Use that project\'s service account so data matches.');
    }
  }
  if (!admin.apps.length) {
    admin.initializeApp({ credential: admin.credential.cert(key) });
  }
  return admin;
}

async function main() {
  initAdmin();
  const auth = admin.auth();
  const db = admin.firestore();

  const driverUids = [];
  const ownerUids = [];
  const officerUids = [];
  const vehiclePlates = [];

  console.log('Creating officers (Auth + Firestore)...');
  for (let i = 0; i < 3; i++) {
    const name = OFFICER_NAMES[i] || pick(OFFICER_NAMES);
    const email = `officer${i + 1}@ltms.gov.ph`;
    try {
      const user = await auth.createUser({
        email,
        password: DEFAULT_PASSWORD,
        displayName: name,
      });
      await db.collection('officers').doc(user.uid).set({
        id: user.uid,
        fullName: name,
        badgeNumber: `LTMS-OPS-${1000 + i}`,
        role: 'Traffic Officer',
        station: STATIONS[i] || pick(STATIONS),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      officerUids.push(user.uid);
      console.log('  Officer:', email);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') {
        const existing = await auth.getUserByEmail(email);
        officerUids.push(existing.uid);
      } else throw e;
    }
  }

  console.log('Creating drivers (Auth + Firestore)...');
  const driverNames = pickMany(NAMES, 8);
  for (let i = 0; i < driverNames.length; i++) {
    const name = driverNames[i];
    const base = name.replace(/\s+/g, '').toLowerCase();
    const email = `${base}${i}@fake.ltms.com`;
    const licenseNum = licenseNumber();
    const expiry = futureDate();
    try {
      const user = await auth.createUser({
        email,
        password: licenseNum.slice(-6),
        displayName: name,
      });
      await db.collection('drivers').doc(user.uid).set({
        id: user.uid,
        fullName: name,
        licenseNumber: licenseNum,
        licenseExpiry: expiry,
        licenseStatus: 'valid',
        isFirstLogin: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      driverUids.push({ uid: user.uid, name });
      console.log('  Driver:', email);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') continue;
      throw e;
    }
  }

  console.log('Creating vehicle owners (Auth + Firestore)...');
  const ownerNames = pickMany(NAMES, 3);
  const companies = ['Rent-A-Car Cebu', 'Island Wheels', 'Drive Safe Co.'];
  for (let i = 0; i < ownerNames.length; i++) {
    const name = ownerNames[i];
    const base = name.replace(/\s+/g, '').toLowerCase();
    const email = `owner.${base}${i}@fake.ltms.com`;
    try {
      const user = await auth.createUser({
        email,
        password: DEFAULT_PASSWORD,
        displayName: name,
      });
      await db.collection('vehicleOwners').doc(user.uid).set({
        id: user.uid,
        fullName: name,
        email,
        companyName: companies[i] || null,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      ownerUids.push({ uid: user.uid, name });
      console.log('  Owner:', email);
    } catch (e) {
      if (e.code === 'auth/email-already-exists') continue;
      throw e;
    }
  }

  const allOwners = [...driverUids.map((d) => ({ ...d, type: 'driver' })), ...ownerUids.map((o) => ({ ...o, type: 'owner' }))];

  console.log('Creating vehicles...');
  for (let i = 0; i < 12; i++) {
    const plate = randomPlate().replace(/\s/g, '');
    const owner = pick(allOwners);
    const year = randomYear();
    await db.collection('vehicles').doc(plate).set({
      plateNumber: plate,
      chasisNo: `CH${Date.now()}${i}`,
      fileNo: `F-${2020 + i}-${1000 + i}`,
      vehicleType: pick(VEHICLE_TYPES),
      vehicleCategory: pick(VEHICLE_CATEGORIES),
      brand: pick(BRANDS),
      color: pick(COLORS),
      ownerId: owner.uid,
      ownerName: owner.name,
      ownerType: owner.type,
      series: pick(MODELS),
      yearModel: year,
      crNo: `CR-${year}-${10000 + i}`,
      orNo: `OR-${year}-${50000 + i}`,
      status: 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    vehiclePlates.push(plate);
  }
  console.log('  Vehicles:', vehiclePlates.length);

  console.log('Creating authorizations (borrowed)...');
  let authCount = 0;
  const rentalOwnerUids = ownerUids.map((o) => o.uid);
  const driverUidsOnly = driverUids.map((d) => d.uid);
  for (const plate of vehiclePlates.slice(0, 5)) {
    const vehicleSnap = await db.collection('vehicles').doc(plate).get();
    const vehicle = vehicleSnap.data();
    const ownerId = vehicle.ownerId;
    const driver = pick(driverUids.filter((d) => d.uid !== ownerId));
    if (!driver) continue;
    const authId = `${plate}_${driver.uid}`;
    await db.collection('authorizations').doc(authId).set({
      plateNumber: plate,
      driverUid: driver.uid,
      driverName: driver.name,
      status: 'ACTIVE',
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
    authCount++;
  }
  console.log('  Authorizations:', authCount);

  console.log('Creating sample scan logs...');
  for (let i = 0; i < 5; i++) {
    if (officerUids.length && driverUidsOnly.length) {
      await db.collection('scanLogs').add({
        officerId: pick(officerUids),
        driverId: pick(driverUidsOnly),
        plateNumber: pick(vehiclePlates),
        result: pick(['VALID', 'VALID', 'EXPIRED']),
        timestamp: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: new Date().toISOString(),
      });
    }
  }
  console.log('  Scan logs: 5');

  console.log('\nDone. Summary:');
  console.log('  Officers:', officerUids.length, '(e.g. officer1@ltms.gov.ph /', DEFAULT_PASSWORD + ')');
  console.log('  Drivers:', driverUids.length, '(email: ...@fake.ltms.com, password: last 6 of license)');
  console.log('  Vehicle owners:', ownerUids.length);
  console.log('  Vehicles:', vehiclePlates.length);
  console.log('  Authorizations:', authCount);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
