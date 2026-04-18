const mongoose = require('mongoose');

const mongoUri = process.env.MONGO_URI;

mongoose.connection.on('connected', () => {
    console.log("MongoDB connected");
});

mongoose.connection.on('error', (err) => {
    console.error("MongoDB connection error:", err.message);
});

async function connectDB() {
    try {
        await mongoose.connect(mongoUri, {
            serverSelectionTimeoutMS: 10000
        });
    } catch (err) {
        console.error("MongoDB initial connection failed:", err.message);
        throw err;
    }
}

module.exports = connectDB;
