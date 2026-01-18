const express = require('express');
const router = express.Router();
const {
    upload,
    previewExcel,
    importProductsFromExcel,
    getTemplateInfo
} = require('../controllers/importController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All import routes require authentication
router.use(protect);

// GET /api/import/template - Get template info
router.get('/template', getTemplateInfo);

// POST /api/import/preview - Preview Excel file
router.post('/preview',
    authorize('admin', 'manager'),
    upload.single('file'),
    previewExcel
);

// POST /api/import/products - Import products from Excel
router.post('/products',
    authorize('admin', 'manager'),
    upload.single('file'),
    importProductsFromExcel
);

module.exports = router;
