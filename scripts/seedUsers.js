require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../models/User');

const seedUsers = async () => {
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log("✅ MongoDB Connected\n");

        // Define users to create
        const usersToCreate = [
            {
                name: 'Administrador',
                email: 'admin@metalstock.pt',
                password: 'admin123',
                role: 'admin'
            },
            {
                name: 'Gestor Produção',
                email: 'gestor@metalstock.pt',
                password: 'gestor123',
                role: 'manager'
            },
            {
                name: 'Operador CNC',
                email: 'operador@metalstock.pt',
                password: 'operador123',
                role: 'worker'
            }
        ];

        console.log("📋 Verificando contas existentes...\n");

        for (const userData of usersToCreate) {
            const existingUser = await User.findOne({ email: userData.email });

            if (existingUser) {
                console.log(`⏭️  ${userData.role.toUpperCase()}: ${userData.email} já existe`);
            } else {
                await User.create(userData);
                console.log(`✅ ${userData.role.toUpperCase()}: ${userData.email} criado com sucesso`);
            }
        }

        console.log("\n========================================");
        console.log("📊 CONTAS DISPONÍVEIS:");
        console.log("========================================");
        console.log("| Role       | Email                    | Password     |");
        console.log("|------------|--------------------------|--------------|");
        console.log("| admin      | admin@metalstock.pt      | admin123     |");
        console.log("| manager    | gestor@metalstock.pt     | gestor123    |");
        console.log("| worker     | operador@metalstock.pt   | operador123  |");
        console.log("========================================\n");

        process.exit();
    } catch (error) {
        console.error("❌ Erro ao criar utilizadores:", error);
        process.exit(1);
    }
};

seedUsers();
