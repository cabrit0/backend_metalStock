const Product = require('../models/Product');
const StockItem = require('../models/StockItem');
const { createStockAlert, createNotification } = require('./notificationController');

/**
 * Check stock levels for all products and create alerts
 * This should be called periodically (e.g., after movements or on a schedule)
 */
const checkStockLevels = async () => {
    try {
        // Get all active products with stock configuration
        const products = await Product.find({
            active: true,
            'stockConfig.minStock': { $gt: 0 }
        });

        for (const product of products) {
            // Calculate total stock for this product
            const stockData = await StockItem.getTotalStock(product._id);
            const totalStock = stockData.totalWeight || stockData.totalQuantity;

            const minStock = product.stockConfig.minStock;
            const safetyStock = product.stockConfig.safetyStock || minStock * 1.5;

            // Check if we need to create an alert
            if (totalStock <= minStock && totalStock > 0) {
                // Critical level - create alert if not already exists recently
                const existingAlert = await checkRecentAlert(product._id, 'STOCK_CRITICAL');
                if (!existingAlert) {
                    await createStockAlert(product, 'critical');
                }
            } else if (totalStock <= safetyStock && totalStock > minStock) {
                // Warning level
                const existingAlert = await checkRecentAlert(product._id, 'STOCK_WARNING');
                if (!existingAlert) {
                    await createStockAlert(product, 'warning');
                }
            }
        }

        return { success: true, message: 'Stock levels checked' };
    } catch (error) {
        console.error('CheckStockLevels error:', error);
        return { success: false, error: error.message };
    }
};

/**
 * Check if a similar alert was created in the last 24 hours
 */
const checkRecentAlert = async (productId, type) => {
    const Notification = require('../models/Notification');
    const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

    const existing = await Notification.findOne({
        relatedProduct: productId,
        type: type,
        createdAt: { $gte: oneDayAgo }
    });

    return existing;
};

/**
 * Get products with stock below safety levels
 */
const getLowStockProducts = async () => {
    try {
        const products = await Product.find({
            active: true,
            'stockConfig.minStock': { $gt: 0 }
        });

        const lowStockProducts = [];

        for (const product of products) {
            const stockData = await StockItem.getTotalStock(product._id);
            const totalStock = stockData.totalWeight || stockData.totalQuantity;

            const minStock = product.stockConfig.minStock;
            const safetyStock = product.stockConfig.safetyStock || minStock * 1.5;

            if (totalStock <= safetyStock) {
                lowStockProducts.push({
                    product: {
                        _id: product._id,
                        code: product.code,
                        description: product.description,
                        materialType: product.materialType
                    },
                    currentStock: totalStock,
                    minStock,
                    safetyStock,
                    status: totalStock <= minStock ? 'critical' : 'warning',
                    unit: product.stockConfig.unit
                });
            }
        }

        return lowStockProducts;
    } catch (error) {
        console.error('GetLowStockProducts error:', error);
        return [];
    }
};

module.exports = {
    checkStockLevels,
    getLowStockProducts
};
