const express = require('express');
const router = express.Router();
const { getShoppingList, getInventoryValuation, getProjectCost, checkStockAlerts, getProductsWithStock } = require('../controllers/reportController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All report routes are protected
router.use(protect);

// GET /api/reports/shopping-list
// Admin and Manager can generate shopping lists
router.get('/shopping-list', authorize('admin', 'manager'), getShoppingList);

// GET /api/reports/valuation
// Only Admin can see financial valuation
router.get('/valuation', authorize('admin'), getInventoryValuation);

// GET /api/reports/project/:projectRef
router.get('/project/:projectRef', authorize('admin', 'manager'), getProjectCost);

// POST /api/reports/check-stock-alerts
// Admin and Manager can trigger stock level check
router.post('/check-stock-alerts', authorize('admin', 'manager'), checkStockAlerts);

// GET /api/reports/products-stock
// Get products with available stock for project material selection
router.get('/products-stock', getProductsWithStock);

module.exports = router;
