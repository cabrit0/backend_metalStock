const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Generate JWT Token
 * @param {string} userId - User's MongoDB ObjectId
 * @returns {string} JWT token
 */
const generateToken = (userId) => {
    return jwt.sign(
        { id: userId },
        process.env.JWT_SECRET,
        { expiresIn: '7d' } // Token expires in 7 days
    );
};

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public (for first admin) / Admin only (for other users)
 */
const register = async (req, res) => {
    try {
        const { name, email, password, role } = req.body;

        // Check if user already exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Este email já está registado'
            });
        }

        // Check if this is the first user (will be admin)
        const userCount = await User.countDocuments();
        const isFirstUser = userCount === 0;

        // Create user
        const user = await User.create({
            name,
            email,
            password,
            role: isFirstUser ? 'admin' : (role || 'worker')
        });

        // Generate token
        const token = generateToken(user._id);

        res.status(201).json({
            success: true,
            message: isFirstUser ? 'Conta Admin criada com sucesso' : 'Utilizador criado com sucesso',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        console.error('Register error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao criar utilizador',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Login user
 * @route   POST /api/auth/login
 * @access  Public
 */
const login = async (req, res) => {
    try {
        const { email, password } = req.body;

        // Validate input
        if (!email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Por favor forneça email e password'
            });
        }

        // Find user and include password for comparison
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Check if user is active
        if (!user.active) {
            return res.status(401).json({
                success: false,
                message: 'Conta desativada. Contacte o administrador.'
            });
        }

        // Compare passwords
        const isMatch = await user.comparePassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Credenciais inválidas'
            });
        }

        // Update last login
        await user.updateLastLogin();

        // Generate token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Login efetuado com sucesso',
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role
                },
                token
            }
        });
    } catch (error) {
        console.error('Login error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao fazer login',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
};

/**
 * @desc    Get current logged in user
 * @route   GET /api/auth/me
 * @access  Private
 */
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user.id);

        res.json({
            success: true,
            data: {
                user: {
                    id: user._id,
                    name: user.name,
                    email: user.email,
                    role: user.role,
                    lastLogin: user.lastLogin,
                    createdAt: user.createdAt
                }
            }
        });
    } catch (error) {
        console.error('GetMe error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter dados do utilizador'
        });
    }
};

/**
 * @desc    Update user password
 * @route   PUT /api/auth/password
 * @access  Private
 */
const updatePassword = async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        // Get user with password
        const user = await User.findById(req.user.id).select('+password');

        // Check current password
        const isMatch = await user.comparePassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({
                success: false,
                message: 'Password atual incorreta'
            });
        }

        // Update password
        user.password = newPassword;
        await user.save();

        // Generate new token
        const token = generateToken(user._id);

        res.json({
            success: true,
            message: 'Password atualizada com sucesso',
            data: { token }
        });
    } catch (error) {
        console.error('UpdatePassword error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar password'
        });
    }
};

/**
 * @desc    Get all users (Admin only)
 * @route   GET /api/auth/users
 * @access  Private/Admin
 */
const getUsers = async (req, res) => {
    try {
        const users = await User.find().select('-password').sort('-createdAt');
        res.json({
            success: true,
            data: users
        });
    } catch (error) {
        console.error('GetUsers error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter utilizadores'
        });
    }
};

/**
 * @desc    Delete user (Admin only)
 * @route   DELETE /api/auth/users/:id
 * @access  Private/Admin
 */
const deleteUser = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilizador não encontrado'
            });
        }

        // Prevent deleting self
        if (user._id.toString() === req.user.id) {
            return res.status(400).json({
                success: false,
                message: 'Não pode eliminar a sua própria conta'
            });
        }

        await user.deleteOne();

        res.json({
            success: true,
            message: 'Utilizador eliminado com sucesso',
            data: {}
        });
    } catch (error) {
        console.error('DeleteUser error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao eliminar utilizador'
        });
    }
};

/**
 * @desc    Update user (Admin only)
 * @route   PUT /api/auth/users/:id
 * @access  Private/Admin
 */
const updateUser = async (req, res) => {
    try {
        const { name, role, active } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'Utilizador não encontrado'
            });
        }

        // Prevent modifying own role
        if (user._id.toString() === req.user.id && role && role !== user.role) {
            return res.status(400).json({
                success: false,
                message: 'Não pode alterar a sua própria role'
            });
        }

        // Update fields
        if (name) user.name = name;
        if (role) user.role = role;
        if (typeof active === 'boolean') user.active = active;

        await user.save();

        res.json({
            success: true,
            message: 'Utilizador atualizado com sucesso',
            data: {
                id: user._id,
                name: user.name,
                email: user.email,
                role: user.role,
                active: user.active
            }
        });
    } catch (error) {
        console.error('UpdateUser error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar utilizador'
        });
    }
};

module.exports = {
    register,
    login,
    getMe,
    updatePassword,
    getUsers,
    deleteUser,
    updateUser,
    generateToken
};
