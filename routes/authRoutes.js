const express = require('express');
const router = express.Router();
const { register, login, getMe, updatePassword, getUsers, deleteUser, updateUser } = require('../controllers/authController');
const { protect, authorize } = require('../middleware/authMiddleware');

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes (Logged in users)
router.get('/me', protect, getMe);
router.put('/password', protect, updatePassword);

// Admin routes
router.get('/users', protect, authorize('admin'), getUsers);
router.put('/users/:id', protect, authorize('admin'), updateUser);
router.delete('/users/:id', protect, authorize('admin'), deleteUser);

module.exports = router;

