const Notification = require('../models/Notification');

/**
 * @desc    Get notifications for current user
 * @route   GET /api/notifications
 * @access  Private
 */
const getNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({
            $or: [
                { user: req.user._id },
                { user: null } // Broadcast notifications
            ]
        })
            .sort('-createdAt')
            .limit(50)
            .populate('relatedProduct', 'code description');

        const unreadCount = await Notification.countDocuments({
            $or: [
                { user: req.user._id },
                { user: null }
            ],
            read: false
        });

        res.json({
            success: true,
            data: {
                notifications,
                unreadCount
            }
        });
    } catch (error) {
        console.error('GetNotifications error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter notificações'
        });
    }
};

/**
 * @desc    Mark notification as read
 * @route   PUT /api/notifications/:id/read
 * @access  Private
 */
const markAsRead = async (req, res) => {
    try {
        const notification = await Notification.findById(req.params.id);

        if (!notification) {
            return res.status(404).json({
                success: false,
                message: 'Notificação não encontrada'
            });
        }

        notification.read = true;
        await notification.save();

        res.json({
            success: true,
            message: 'Notificação marcada como lida'
        });
    } catch (error) {
        console.error('MarkAsRead error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar notificação'
        });
    }
};

/**
 * @desc    Mark all notifications as read
 * @route   PUT /api/notifications/read-all
 * @access  Private
 */
const markAllAsRead = async (req, res) => {
    try {
        await Notification.updateMany(
            {
                $or: [
                    { user: req.user._id },
                    { user: null }
                ],
                read: false
            },
            { read: true }
        );

        res.json({
            success: true,
            message: 'Todas as notificações marcadas como lidas'
        });
    } catch (error) {
        console.error('MarkAllAsRead error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao marcar notificações'
        });
    }
};

/**
 * @desc    Create a notification (internal use)
 * @param   {Object} data - { user, type, title, message, relatedProduct, priority }
 */
const createNotification = async (data) => {
    try {
        const notification = await Notification.create(data);
        return notification;
    } catch (error) {
        console.error('CreateNotification error:', error);
        return null;
    }
};

/**
 * @desc    Create stock alert notification
 * @param   {Object} product - Product document
 * @param   {string} alertType - 'critical' or 'warning'
 */
const createStockAlert = async (product, alertType) => {
    const type = alertType === 'critical' ? 'STOCK_CRITICAL' : 'STOCK_WARNING';
    const priority = alertType === 'critical' ? 'high' : 'medium';
    const title = alertType === 'critical' ? 'Stock Crítico' : 'Stock Baixo';
    const message = `${product.code} - ${product.description} atingiu nível ${alertType === 'critical' ? 'crítico' : 'de alerta'}`;

    return createNotification({
        user: null, // Broadcast to all
        type,
        title,
        message,
        relatedProduct: product._id,
        priority
    });
};

module.exports = {
    getNotifications,
    markAsRead,
    markAllAsRead,
    createNotification,
    createStockAlert
};
