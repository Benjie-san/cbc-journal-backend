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
const authMiddleware = require("./middleware/auth");
const app = express();

// REQUIRED MIDDLEWARE
app.use(helmet());
app.use(cors()); // For dev, allow all – later you can restrict to your app domain
app.use(express.json());
app.use(morgan("dev"));



app.get("/", (req, res) => {
    res.json({ status: "ok" });
});

// Routes
app.use("/me", meRoutes);
app.use("/journals", journalRoutes);
app.use("/auth", authRoutes);


//PORT
const PORT = process.env.PORT || 4000;
console.log(PORT)
connectDB().then(() => {
    app.listen(PORT, () => {
        console.log(`🚀 API running at http://localhost:${PORT}`);
    });
});
