// https://firebase.google.com/docs/auth/web/google-signin#web
// https://firebase.google.com/docs/auth/web/redirect-best-practices
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth"
import { GoogleAuthProvider } from "firebase/auth";

const firebaseConfig = {
    apiKey: "AIzaSyBl4ANq4k03yXye_Ac68w6ofLV0dKZ4O40",
    authDomain: "alersense-e5a43.firebaseapp.com",
    projectId: "alersense-e5a43",
    storageBucket: "alersense-e5a43.firebasestorage.app",
    messagingSenderId: "648576939309",
    appId: "1:648576939309:web:7b69b67a82d1a90758cfa4",
    measurementId: "G-ZV3FDHKX6C"
};

const app = initializeApp(firebaseConfig);
const googleProvider = new GoogleAuthProvider()
googleProvider.addScope('https://www.googleapis.com/auth/contacts.readonly');
googleProvider.setCustomParameters({
    "login_hint": "user@example.com"
})
const auth = getAuth();
auth.useDeviceLanguage();

