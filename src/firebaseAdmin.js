// src/firebaseAdmin.js
const admin = require("firebase-admin");
const fs = require("node:fs");
const path = require("node:path");

function readServiceAccountFile(filePath) {
    try {
        return JSON.parse(fs.readFileSync(filePath, "utf8"));
    } catch (err) {
        throw new Error(`Unable to load Firebase service account from ${filePath}`);
    }
}

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
    if (process.env.FIREBASE_SERVICE_ACCOUNT_PATH) {
        return readServiceAccountFile(path.resolve(process.env.FIREBASE_SERVICE_ACCOUNT_PATH));
    }
    return readServiceAccountFile(path.join(__dirname, "..", "firebase-service-account.json"));
}

const serviceAccount = loadServiceAccount();

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

module.exports = admin;
