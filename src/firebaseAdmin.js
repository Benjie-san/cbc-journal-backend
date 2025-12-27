// src/firebaseAdmin.js
const admin = require("firebase-admin");

function loadServiceAccount() {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
        try {
            return JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
        } catch (err) {
            throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT JSON");
        }
    }
    if (process.env.FIREBASE_SERVICE_ACCOUNT_BASE64) {
        try {
            const json = Buffer.from(
                process.env.FIREBASE_SERVICE_ACCOUNT_BASE64,
                "base64"
            ).toString("utf8");
            return JSON.parse(json);
        } catch (err) {
            throw new Error("Invalid FIREBASE_SERVICE_ACCOUNT_BASE64");
        }
    }
    return require("../firebase-service-account.json");
}

const serviceAccount = loadServiceAccount();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
