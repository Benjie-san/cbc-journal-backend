const jwt = require("jsonwebtoken");
const User = require("../models/User");

module.exports = async function jwtAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({ error: "Missing token" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.userId);

        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }

        const tokenVersion = Number(user.tokenVersion ?? 0);
        const decodedVersion = Number(decoded.tokenVersion ?? 0);
        if (tokenVersion !== decodedVersion) {
            return res.status(401).json({ error: "Session revoked" });
        }

        req.user = {
            userId: decoded.userId,
            role: decoded.role,
            tokenVersion: decodedVersion,
        };

        next();
    } catch (err) {
        console.error("JWT auth error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};
