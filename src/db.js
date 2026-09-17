const mongoose = require("mongoose");

async function connectDB({ uri = process.env.MONGODB_URI, client = mongoose } = {}) {
    if (!uri) {
        throw new Error("MONGODB_URI is required");
    }
    await client.connect(uri);
    console.log("[server] connected to MongoDB");
    return client;
}

async function pingDB({ client = mongoose } = {}) {
    if (!client.connection?.db) {
        throw new Error("MongoDB is not connected");
    }
    return client.connection.db.admin().ping();
}

async function closeDB({ client = mongoose } = {}) {
    if (client.connection?.readyState) {
        await client.connection.close(false);
    }
}

module.exports = { closeDB, connectDB, pingDB };
