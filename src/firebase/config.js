/**
 * Single source of truth for Firebase project config.
 * Must match the project used by seed-firebase.cjs so fetched data matches seeded structure.
 * Collections (per seed): officers, drivers, vehicleOwners, vehicles, authorizations, scanLogs.
 */
export const firebaseConfig = {
  apiKey: 'AIzaSyBAFtprk1eQ8b_FCpSR27RJByk7LAsnQEA',
  authDomain: 'valicheck-21c70.firebaseapp.com',
  databaseURL: 'https://valicheck-21c70-default-rtdb.asia-southeast1.firebasedatabase.app',
  projectId: 'valicheck-21c70',
  storageBucket: 'valicheck-21c70.firebasestorage.app',
  messagingSenderId: '323070233308',
  appId: '1:323070233308:web:f251e083a50d18036b8219',
  measurementId: 'G-MDD2SQMD3L',
};
