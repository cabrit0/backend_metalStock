const jwt = require('jsonwebtoken');
const User = require('../models/User');

/**
 * Authentication Middleware
 * Protects routes by verifying JWT token
 * 
 * Usage: router.get('/protected', protect, handler)
 */
const protect = async (req, res, next) => {
    try {
        let token;

        // Check for token in Authorization header
        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        // Check if token exists
        if (!token) {
            return res.status(401).json({
                success: false,
                message: 'Não autorizado. Por favor faça login.'
            });
        }

        try {
            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token
            const user = await User.findById(decoded.id);

            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: 'Utilizador não encontrado'
                });
            }

            if (!user.active) {
                return res.status(401).json({
                    success: false,
                    message: 'Conta desativada'
                });
            }

            // Attach user to request
            req.user = user;
            next();
        } catch (error) {
            return res.status(401).json({
                success: false,
                message: 'Token inválido ou expirado'
            });
        }
    } catch (error) {
        console.error('Auth middleware error:', error);
        return res.status(500).json({
            success: false,
            message: 'Erro de autenticação'
        });
    }
};

/**
 * Role Authorization Middleware
 * Restricts access based on user roles
 * 
 * Usage: router.get('/admin-only', protect, authorize('admin'), handler)
 * Usage: router.get('/staff', protect, authorize('admin', 'manager'), handler)
 * 
 * @param {...string} roles - Allowed roles
 */
const authorize = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: 'Não autorizado'
            });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({
                success: false,
                message: `Role '${req.user.role}' não tem permissão para aceder a este recurso`
            });
        }

        next();
    };
};

/**
 * Optional Auth Middleware
 * Attaches user to request if token is valid, but doesn't require it
 * Useful for endpoints that behave differently for logged-in users
 */
const optionalAuth = async (req, res, next) => {
    try {
        let token;

        if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
            token = req.headers.authorization.split(' ')[1];
        }

        if (token) {
            try {
                const decoded = jwt.verify(token, process.env.JWT_SECRET);
                const user = await User.findById(decoded.id);
                if (user && user.active) {
                    req.user = user;
                }
            } catch (error) {
                // Token invalid, but that's okay for optional auth
            }
        }

        next();
    } catch (error) {
        next();
    }
};

module.exports = { protect, authorize, optionalAuth };
