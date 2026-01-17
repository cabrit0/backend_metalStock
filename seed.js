/**
 * Seed Script - Create Initial Admin User
 * 
 * Run from backend folder: node seed.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import User model
const User = require('./models/User');

// Admin credentials
const ADMIN = {
    name: 'Administrador',
    email: 'admin@metalstock.pt',
    password: 'admin123',
    role: 'admin'
};

async function seedAdmin() {
    try {
        console.log('🔌 Connecting to MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');

        const userCount = await User.countDocuments();

        if (userCount > 0) {
            console.log(`ℹ️  Database already has ${userCount} user(s). Skipping seed.`);
        } else {
            console.log('👤 Creating admin user...');
            const admin = await User.create(ADMIN);
            console.log('✅ Admin created:', admin.email, '| Role:', admin.role);
            console.log('⚠️  Default password: admin123 - CHANGE THIS!');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
        if (error.errors) {
            Object.keys(error.errors).forEach(key => {
                console.error(`   - ${key}: ${error.errors[key].message}`);
            });
        }
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected');
        process.exit(0);
    }
}

seedAdmin();
