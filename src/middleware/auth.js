// src/middleware/auth.js
const admin = require("../firebaseAdmin");

async function authMiddleware(req, res, next) {
    try {
        console.log("AUTH HEADER:", req.headers.authorization);

        const header = req.headers.authorization || "";
        const [type, token] = header.split(" ");

        if (type !== "Bearer" || !token) {
        return res.status(401).json({ error: "Missing or invalid Authorization header" });
        }

        const decoded = await admin.auth().verifyIdToken(token);

        // Attach minimal user info to request
        req.user = {
        firebaseUid: decoded.uid,
        email: decoded.email || null,
        phoneNumber: decoded.phone_number || null,
        };

        next();
    } catch (err) {
        console.error("Auth error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
}

module.exports = authMiddleware;
