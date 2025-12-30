// src/index.js
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const { connectDB } = require("./db");

const meRoutes = require("./routes/me");
const journalRoutes = require("./routes/journals");
const authRoutes = require("./routes/auth");
const readingPlanRoutes = require("./routes/readingPlan");
const { apiLimiter, authLimiter } = require("./middleware/rateLimit");
const app = express();

// REQUIRED MIDDLEWARE
app.set("trust proxy", 1);
app.use(helmet());
const corsOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
  : null;
app.use(cors(corsOrigins ? { origin: corsOrigins, credentials: true } : undefined));
app.use(express.json());
app.use(morgan("dev"));



app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

// Routes
app.use("/me", apiLimiter, meRoutes);
app.use("/journals", apiLimiter, journalRoutes);
app.use("/auth", authLimiter, authRoutes);
app.use("/reading-plan", apiLimiter, readingPlanRoutes);


//PORT
const PORT = process.env.PORT || 4000;
console.log(PORT)
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 API running at http://localhost:${PORT}`);
    });
});

