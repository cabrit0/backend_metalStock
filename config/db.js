const mongoose = require('mongoose');

/**
 * Connect to MongoDB Atlas
 * Uses connection string from environment variable MONGODB_URI
 */
const connectDB = async () => {
    try {
        // Check if connection string exists
        if (!process.env.MONGODB_URI) {
            console.warn('⚠️ MONGODB_URI not set. Database connection skipped.');
            return null;
        }

        const conn = await mongoose.connect(process.env.MONGODB_URI, {
            // Mongoose 6+ no longer needs these options, but we keep them for clarity
            // useNewUrlParser: true,
            // useUnifiedTopology: true,
        });

        console.log(`✅ MongoDB Connected: ${conn.connection.host}`);
        return conn;
    } catch (error) {
        console.error(`❌ MongoDB Connection Error: ${error.message}`);
        // Don't exit in serverless environment
        if (process.env.NODE_ENV !== 'production') {
            process.exit(1);
        }
        throw error;
    }
};

module.exports = connectDB;
