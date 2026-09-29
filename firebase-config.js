// js/firebase-config.js
const firebaseConfig = {
  apiKey: "AIzaSyABG1MuczTh6KlJxSaUvFwTszCMVNvaA3g",
  authDomain: "faculty-marketplac.firebaseapp.com",
  databaseURL: "https://faculty-marketplac-default-rtdb.firebaseio.com",
  projectId: "faculty-marketplac",
  storageBucket: "faculty-marketplac.firebasestorage.app",
  messagingSenderId: "110077750433",
  appId: "1:110077750433:web:148d115889410c13881468",
  measurementId: "G-2Z8Q49V5EX"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();