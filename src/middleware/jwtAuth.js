const jwt = require("jsonwebtoken");

module.exports = function jwtAuth(req, res, next) {
    const header = req.headers.authorization || "";
    const [type, token] = header.split(" ");

    if (type !== "Bearer" || !token) {
        return res.status(401).json({ error: "Missing token" });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        req.user = {
        userId: decoded.userId,
        role: decoded.role,
        };

        next();
    } catch (err) {
        console.error("JWT auth error:", err.message);
        return res.status(401).json({ error: "Invalid or expired token" });
    }
};
