const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

/**
 * User Schema for MetalStock Pro
 * Implements RBAC (Role-Based Access Control)
 * 
 * Roles:
 * - admin: Full access, can manage users and all settings
 * - manager: Can manage inventory, view reports
 * - worker: Can perform stock operations (entries/exits/cuts)
 */
const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Nome é obrigatório'],
        trim: true,
        maxlength: [100, 'Nome não pode exceder 100 caracteres']
    },
    email: {
        type: String,
        required: [true, 'Email é obrigatório'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Por favor use um email válido']
    },
    password: {
        type: String,
        required: [true, 'Password é obrigatória'],
        minlength: [6, 'Password deve ter pelo menos 6 caracteres'],
        select: false // Don't include password in queries by default
    },
    role: {
        type: String,
        enum: {
            values: ['admin', 'manager', 'worker'],
            message: 'Role deve ser: admin, manager, ou worker'
        },
        default: 'worker'
    },
    active: {
        type: Boolean,
        default: true
    },
    lastLogin: {
        type: Date
    }
}, {
    timestamps: true // Adds createdAt and updatedAt
});

// Index for faster email lookups
userSchema.index({ email: 1 });

/**
 * Pre-save middleware to hash password
 * Only runs if password was modified
 * Note: Mongoose 9.x async middleware doesn't use next()
 */
userSchema.pre('save', async function () {
    // Only hash if password was modified
    if (!this.isModified('password')) {
        return;
    }

    // Generate salt and hash password
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
});

/**
 * Compare entered password with hashed password
 * @param {string} enteredPassword - Plain text password to compare
 * @returns {Promise<boolean>} True if passwords match
 */
userSchema.methods.comparePassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

/**
 * Update last login timestamp
 */
userSchema.methods.updateLastLogin = async function () {
    this.lastLogin = new Date();
    await this.save({ validateBeforeSave: false });
};

/**
 * Check if user has required role
 * @param {string|string[]} roles - Role or array of roles to check
 * @returns {boolean} True if user has one of the required roles
 */
userSchema.methods.hasRole = function (roles) {
    if (typeof roles === 'string') {
        return this.role === roles;
    }
    return roles.includes(this.role);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
