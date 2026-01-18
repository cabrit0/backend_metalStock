require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedAdmin = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log("MongoDB Connected");

        const adminExists = await User.findOne({ email: 'admin@metalstock.pt' });

        if (adminExists) {
            console.log("Admin user already exists");
        } else {
            const admin = await User.create({
                name: 'Administrador',
                email: 'admin@metalstock.pt',
                password: 'admin', // Will be hashed by pre-save
                role: 'admin',
                active: true
            });
            console.log("Admin user created successfully");
            console.log("Email: admin@metalstock.pt");
            console.log("Password: admin");
        }

        process.exit();
    } catch (error) {
        console.error("Error seeding admin:", error);
        process.exit(1);
    }
};

seedAdmin();
