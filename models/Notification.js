const mongoose = require('mongoose');

/**
 * Notification Schema for MetalStock Pro
 * Used for alerting users about stock levels, movements, and system events
 */
const notificationSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: false // null = broadcast to all admins/managers
    },
    type: {
        type: String,
        enum: ['STOCK_CRITICAL', 'STOCK_WARNING', 'MOVEMENT', 'SYSTEM'],
        required: true
    },
    title: {
        type: String,
        required: true,
        maxlength: 100
    },
    message: {
        type: String,
        required: true,
        maxlength: 500
    },
    read: {
        type: Boolean,
        default: false
    },
    relatedProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: false
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    }
}, {
    timestamps: true
});

// Index for faster queries
notificationSchema.index({ user: 1, read: 1, createdAt: -1 });

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;
