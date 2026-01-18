const Project = require('../models/Project');
const ProjectMaterial = require('../models/ProjectMaterial');
const Product = require('../models/Product');
const StockItem = require('../models/StockItem');
const Movement = require('../models/Movement');

// ============================================
// CRUD DE OBRAS
// ============================================

/**
 * @desc    Get all projects
 * @route   GET /api/projects
 * @access  Private
 */
const getProjects = async (req, res) => {
    try {
        const { status, year, search } = req.query;

        let query = {};

        if (status) {
            query.status = status;
        }

        if (year) {
            query.reference = { $regex: `^OBR-${year}-` };
        }

        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { client: { $regex: search, $options: 'i' } },
                { reference: { $regex: search, $options: 'i' } }
            ];
        }

        const projects = await Project.find(query)
            .sort('-createdAt')
            .populate('createdBy', 'name');

        res.json({
            success: true,
            count: projects.length,
            data: projects
        });
    } catch (error) {
        console.error('GetProjects error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter obras'
        });
    }
};

/**
 * @desc    Get single project with materials
 * @route   GET /api/projects/:id
 * @access  Private
 */
const getProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id)
            .populate('createdBy', 'name');

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        // Get associated materials
        const materials = await ProjectMaterial.find({ project: project._id })
            .populate('product', 'code description materialType')
            .populate('addedBy', 'name')
            .sort('-addedAt');

        // Get statistics
        const stats = await Project.getStats(project._id);

        res.json({
            success: true,
            data: {
                ...project.toObject(),
                materials,
                stats
            }
        });
    } catch (error) {
        console.error('GetProject error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter obra'
        });
    }
};

/**
 * @desc    Get next available reference
 * @route   GET /api/projects/next-reference
 * @access  Private
 */
const getNextReference = async (req, res) => {
    try {
        const reference = await Project.generateReference();
        res.json({
            success: true,
            data: { reference }
        });
    } catch (error) {
        console.error('GetNextReference error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao gerar referência'
        });
    }
};

/**
 * @desc    Create new project
 * @route   POST /api/projects
 * @access  Private
 */
const createProject = async (req, res) => {
    try {
        const { name, client, description, startDate, endDate, budget, saleValue, notes } = req.body;

        // Generate automatic reference
        const reference = await Project.generateReference();

        const project = await Project.create({
            reference,
            name,
            client,
            description,
            startDate,
            endDate,
            budget: budget || { materials: 0, labor: 0, other: 0, total: 0 },
            saleValue: saleValue || 0,
            notes,
            createdBy: req.user._id
        });

        res.status(201).json({
            success: true,
            message: 'Obra criada com sucesso',
            data: project
        });
    } catch (error) {
        console.error('CreateProject error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao criar obra'
        });
    }
};

/**
 * @desc    Update project
 * @route   PUT /api/projects/:id
 * @access  Private
 */
const updateProject = async (req, res) => {
    try {
        const { name, client, description, status, startDate, endDate, budget, saleValue, notes } = req.body;

        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        // Update fields
        if (name) project.name = name;
        if (client) project.client = client;
        if (description !== undefined) project.description = description;
        if (status) {
            project.status = status;
            // Set actual end date when completing
            if (status === 'completed' && !project.actualEndDate) {
                project.actualEndDate = new Date();
            }
        }
        if (startDate) project.startDate = startDate;
        if (endDate) project.endDate = endDate;
        if (budget) project.budget = { ...project.budget, ...budget };
        if (saleValue !== undefined) project.saleValue = saleValue;
        if (notes !== undefined) project.notes = notes;

        await project.save();

        res.json({
            success: true,
            message: 'Obra atualizada com sucesso',
            data: project
        });
    } catch (error) {
        console.error('UpdateProject error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao atualizar obra'
        });
    }
};

/**
 * @desc    Delete project
 * @route   DELETE /api/projects/:id
 * @access  Private/Admin
 */
const deleteProject = async (req, res) => {
    try {
        const project = await Project.findById(req.params.id);

        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        // Check for associated materials
        const materialsCount = await ProjectMaterial.countDocuments({ project: project._id });

        if (materialsCount > 0) {
            return res.status(400).json({
                success: false,
                message: `Não é possível eliminar. Existem ${materialsCount} materiais associados. Remova os materiais primeiro.`
            });
        }

        await project.deleteOne();

        res.json({
            success: true,
            message: 'Obra eliminada com sucesso'
        });
    } catch (error) {
        console.error('DeleteProject error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao eliminar obra'
        });
    }
};

// ============================================
// MATERIAIS DA OBRA
// ============================================

/**
 * @desc    Add material to project
 * @route   POST /api/projects/:id/materials
 * @access  Private
 */
const addMaterial = async (req, res) => {
    try {
        const { productId, quantity, unit, notes } = req.body;

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        // Check if project allows adding materials
        if (['completed', 'cancelled'].includes(project.status)) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível adicionar materiais a uma obra concluída ou cancelada'
            });
        }

        // Get product
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produto não encontrado'
            });
        }

        // Get current stock
        const stockData = await StockItem.getTotalStock(product._id);
        const availableStock = stockData.totalWeight || stockData.totalQuantity || 0;

        // Convert quantity if needed
        let quantityInUnit = quantity;

        // Check stock availability (with 5% tolerance for rounding)
        if (quantityInUnit > availableStock * 1.05) {
            return res.status(400).json({
                success: false,
                message: `Stock insuficiente. Disponível: ${availableStock.toFixed(2)} ${product.stockConfig.unit}`,
                availableStock
            });
        }

        // Get unit cost (use last price or average price)
        const unitCost = product.financial?.lastPrice || product.financial?.averagePrice || 0;

        // Create movement (OUT)
        const movement = await Movement.create({
            type: 'OUT',
            product: product._id,
            user: req.user._id,
            quantityDelta: -quantity,
            unit: unit || product.stockConfig.unit,
            projectRef: project.reference,
            date: new Date(),
            costSnapshot: unitCost,
            notes: `Material para obra ${project.reference}`
        });

        // Decrement stock (find suitable stock item)
        await decrementStock(product._id, quantity);

        // Create ProjectMaterial record
        const projectMaterial = await ProjectMaterial.create({
            project: project._id,
            product: product._id,
            quantity,
            unit: unit || product.stockConfig.unit,
            unitCost,
            addedBy: req.user._id,
            movement: movement._id,
            notes
        });

        // Update project material costs
        const materialTotals = await ProjectMaterial.getProjectTotals(project._id);
        project.costs.materials = materialTotals.totalCost;
        await project.save();

        // Populate for response
        await projectMaterial.populate('product', 'code description');

        res.status(201).json({
            success: true,
            message: 'Material adicionado com sucesso',
            data: projectMaterial
        });
    } catch (error) {
        console.error('AddMaterial error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao adicionar material'
        });
    }
};

/**
 * Helper: Decrement stock from available items
 */
async function decrementStock(productId, quantity) {
    // Get available stock items, prioritizing offcuts first
    const stockItems = await StockItem.find({
        product: productId,
        status: 'available',
        quantity: { $gt: 0 }
    }).sort({ type: -1, calculatedWeight: 1 }); // OFFCUT first, then by weight

    let remaining = quantity;

    for (const item of stockItems) {
        if (remaining <= 0) break;

        const itemStock = item.calculatedWeight || item.quantity;
        const toDeduct = Math.min(remaining, itemStock);

        if (item.calculatedWeight) {
            // Weight-based item
            const ratio = toDeduct / item.calculatedWeight;
            item.quantity = Math.max(0, item.quantity - (item.quantity * ratio));
            item.calculatedWeight = Math.max(0, item.calculatedWeight - toDeduct);
        } else {
            // Unit-based item
            item.quantity = Math.max(0, item.quantity - toDeduct);
        }

        if (item.quantity <= 0) {
            item.status = 'consumed';
        }

        await item.save();
        remaining -= toDeduct;
    }

    return remaining <= 0;
}

/**
 * @desc    Remove material from project
 * @route   DELETE /api/projects/:id/materials/:materialId
 * @access  Private
 */
const removeMaterial = async (req, res) => {
    try {
        const { id, materialId } = req.params;

        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        // Check if project allows removing materials
        if (project.status === 'completed') {
            return res.status(400).json({
                success: false,
                message: 'Não é possível remover materiais de uma obra concluída'
            });
        }

        const projectMaterial = await ProjectMaterial.findById(materialId);
        if (!projectMaterial || projectMaterial.project.toString() !== id) {
            return res.status(404).json({
                success: false,
                message: 'Material não encontrado nesta obra'
            });
        }

        // Create reversal movement (IN)
        await Movement.create({
            type: 'IN',
            product: projectMaterial.product,
            user: req.user._id,
            quantityDelta: projectMaterial.quantity,
            unit: projectMaterial.unit,
            date: new Date(),
            costSnapshot: projectMaterial.unitCost,
            notes: `Devolução de material da obra ${project.reference}`
        });

        // Restore stock
        await restoreStock(projectMaterial.product, projectMaterial.quantity);

        // Delete the project material
        await projectMaterial.deleteOne();

        // Update project costs
        const materialTotals = await ProjectMaterial.getProjectTotals(project._id);
        project.costs.materials = materialTotals.totalCost;
        await project.save();

        res.json({
            success: true,
            message: 'Material removido com sucesso'
        });
    } catch (error) {
        console.error('RemoveMaterial error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover material'
        });
    }
};

/**
 * Helper: Restore stock
 */
async function restoreStock(productId, quantity) {
    // Create or update a stock item
    let stockItem = await StockItem.findOne({
        product: productId,
        status: 'available',
        type: 'FULL_BAR'  // Add back as full bar
    });

    if (stockItem) {
        stockItem.quantity += 1;
        await stockItem.calculateWeight();
        await stockItem.save();
    } else {
        // Create new stock item
        stockItem = await StockItem.create({
            product: productId,
            type: 'FULL_BAR',
            quantity: 1,
            status: 'available'
        });
    }

    return stockItem;
}

// ============================================
// MÃO DE OBRA
// ============================================

/**
 * @desc    Add labor entry to project
 * @route   POST /api/projects/:id/labor
 * @access  Private
 */
const addLabor = async (req, res) => {
    try {
        const { date, worker, hours, hourlyRate, description } = req.body;

        const project = await Project.findById(req.params.id);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        if (['completed', 'cancelled'].includes(project.status)) {
            return res.status(400).json({
                success: false,
                message: 'Não é possível adicionar mão de obra a uma obra concluída ou cancelada'
            });
        }

        const totalCost = hours * hourlyRate;

        project.laborEntries.push({
            date: date || new Date(),
            worker,
            hours,
            hourlyRate,
            description: description || '',
            totalCost
        });

        await project.save();

        res.status(201).json({
            success: true,
            message: 'Mão de obra adicionada com sucesso',
            data: project.laborEntries[project.laborEntries.length - 1]
        });
    } catch (error) {
        console.error('AddLabor error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao adicionar mão de obra'
        });
    }
};

/**
 * @desc    Remove labor entry from project
 * @route   DELETE /api/projects/:id/labor/:entryId
 * @access  Private
 */
const removeLabor = async (req, res) => {
    try {
        const { id, entryId } = req.params;

        const project = await Project.findById(id);
        if (!project) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        const entryIndex = project.laborEntries.findIndex(e => e._id.toString() === entryId);
        if (entryIndex === -1) {
            return res.status(404).json({
                success: false,
                message: 'Entrada de mão de obra não encontrada'
            });
        }

        project.laborEntries.splice(entryIndex, 1);
        await project.save();

        res.json({
            success: true,
            message: 'Entrada de mão de obra removida com sucesso'
        });
    } catch (error) {
        console.error('RemoveLabor error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao remover mão de obra'
        });
    }
};

// ============================================
// ESTATÍSTICAS
// ============================================

/**
 * @desc    Get project statistics
 * @route   GET /api/projects/:id/stats
 * @access  Private
 */
const getProjectStats = async (req, res) => {
    try {
        const stats = await Project.getStats(req.params.id);

        if (!stats) {
            return res.status(404).json({
                success: false,
                message: 'Obra não encontrada'
            });
        }

        res.json({
            success: true,
            data: stats
        });
    } catch (error) {
        console.error('GetProjectStats error:', error);
        res.status(500).json({
            success: false,
            message: 'Erro ao obter estatísticas'
        });
    }
};

module.exports = {
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
};
