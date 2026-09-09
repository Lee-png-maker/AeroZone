
<script type="module">
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.1.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-auth.js";

import {
  getDatabase,
  ref,
  get,
  set,
  update,
  push,
  onValue
} from "https://www.gstatic.com/firebasejs/12.1.0/firebase-database.js";

/* =========================================================
   AEROZONE FIREBASE CONFIG
   Replace these values with your Firebase Web App config.
   ========================================================= */

const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "aerozone-e516a.firebaseapp.com",
  databaseURL: "https://aerozone-e516a-default-rtdb.firebaseio.com",
  projectId: "aerozone-e516a",
  storageBucket: "aerozone-e516a.firebasestorage.app",
  messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
  appId: "YOUR_APP_ID"
};

const app = initializeApp(firebaseConfig);

const auth = getAuth(app);
const db = getDatabase(app);

window.AeroFirebase = {
  app,
  auth,
  db,
  ref,
  get,
  set,
  update,
  push,
  onValue,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut
};
</script>
