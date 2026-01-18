const express = require('express');
const router = express.Router();
const {
    getProjects,
    getProject,
    getNextReference,
    createProject,
    updateProject,
    deleteProject,
    addMaterial,
    removeMaterial,
    addLabor,
    removeLabor,
    getProjectStats
} = require('../controllers/projectController');
const { protect, authorize } = require('../middleware/authMiddleware');

// All routes require authentication
router.use(protect);

// === OBRAS ===

// Get next available reference (must be before /:id route)
router.get('/next-reference', getNextReference);

// Project CRUD
router.route('/')
    .get(getProjects)
    .post(createProject);

router.route('/:id')
    .get(getProject)
    .put(updateProject)
    .delete(authorize('admin', 'manager'), deleteProject);

// === ESTATÍSTICAS ===
router.get('/:id/stats', getProjectStats);

// === MATERIAIS ===
router.route('/:id/materials')
    .post(addMaterial);

router.delete('/:id/materials/:materialId', removeMaterial);

// === MÃO DE OBRA ===
router.route('/:id/labor')
    .post(addLabor);

router.delete('/:id/labor/:entryId', removeLabor);

module.exports = router;
