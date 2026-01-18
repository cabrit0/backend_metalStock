const Product = require('../models/Product');
const StockItem = require('../models/StockItem');
const User = require('../models/User');
const Movement = require('../models/Movement');

/**
 * @desc    Get shopping list (Low stock items)
 * @route   GET /api/reports/shopping-list
 * @access  Private (Admin/Manager)
 */
exports.getShoppingList = async (req, res) => {
    try {
        // 1. Aggregate to find products with their Calculated Total Stock
        const productsWithStock = await Product.aggregate([
            {
                $lookup: {
                    from: 'stockitems',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'stockItems'
                }
            },
            {
                $addFields: {
                    // Filter only available items
                    stockItems: {
                        $filter: {
                            input: '$stockItems',
                            as: 'item',
                            cond: {
                                $and: [
                                    { $ne: ['$$item.status', 'consumed'] },
                                    { $ne: ['$$item.status', 'reserved'] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $addFields: {
                    // Calculate Total Weight (kg) or Quantity depending on unit using reduce
                    // This is an approximation. Ideally we use the 'unit' to decide what to sum.
                    currentStock: {
                        $reduce: {
                            input: '$stockItems',
                            initialValue: 0,
                            in: {
                                $cond: [
                                    // If unit is 'm', sum lengths (in meters? StockItem uses mm)
                                    // If unit is 'kg', sum calculatedWeight
                                    // If unit is 'un', sum quantity
                                    { $eq: ['$stockConfig.unit', 'm'] },
                                    { $add: ['$$value', { $divide: ['$$this.lengthMM', 1000] }] },
                                    {
                                        $cond: [
                                            { $eq: ['$stockConfig.unit', 'kg'] },
                                            { $add: ['$$value', '$$this.calculatedWeight'] },
                                            { $add: ['$$value', '$$this.quantity'] } // 'un' or other
                                        ]
                                    }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $lookup: {
                    from: 'suppliers', // Assuming 'suppliers' collection exists
                    localField: 'suppliers',
                    foreignField: '_id',
                    as: 'supplierDetails'
                }
            },
            {
                // Filter for Critical or Warning Only
                $match: {
                    $expr: {
                        $lte: ['$currentStock', '$stockConfig.safetyStock'] // Catch both Red and Yellow
                    }
                }
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    description: 1,
                    currentStock: 1,
                    'stockConfig.minStock': 1,
                    'stockConfig.safetyStock': 1,
                    'stockConfig.unit': 1,
                    'financial.lastPrice': 1,
                    'financial.averagePrice': 1,
                    supplier: { $arrayElemAt: ['$supplierDetails', 0] }, // Primary Supplier
                    status: {
                        $cond: {
                            if: { $lte: ['$currentStock', '$stockConfig.minStock'] },
                            then: 'CRITICAL',
                            else: 'WARNING'
                        }
                    }
                }
            }
        ]);

        // 2. Group by Supplier in JS (easier than Mongo grouping for nested arrays sometimes)
        const groupedBySupplier = productsWithStock.reduce((acc, item) => {
            const supplierName = item.supplier ? item.supplier.name : 'Sem Fornecedor Definido';
            if (!acc[supplierName]) {
                acc[supplierName] = [];
            }
            acc[supplierName].push(item);
            return acc;
        }, {});

        res.status(200).json({
            success: true,
            count: productsWithStock.length,
            data: groupedBySupplier,
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Report Error:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar relatório de compras' });
    }
};

/**
 * @desc    Get Inventory Valuation (Excel export data)
 * @route   GET /api/reports/valuation
 * @access  Private (Admin)
 */
exports.getInventoryValuation = async (req, res) => {
    try {
        const inventory = await Product.aggregate([
            {
                $lookup: {
                    from: 'stockitems',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'stockItems'
                }
            },
            {
                $addFields: {
                    // Only active/available items
                    stockItems: {
                        $filter: {
                            input: '$stockItems',
                            as: 'item',
                            cond: { $eq: ['$$item.status', 'available'] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    totalWeight: { $sum: '$stockItems.calculatedWeight' },
                    totalQuantity: { $sum: '$stockItems.quantity' },
                    activeStockItemsCount: { $size: '$stockItems' }
                }
            },
            {
                $match: {
                    activeStockItemsCount: { $gt: 0 } // Only list items with physical stock
                }
            },
            {
                $addFields: {
                    valuation: {
                        $multiply: ['$totalWeight', '$financial.averagePrice']
                        // Assuming valuation by Weight * AvgPrice (common in metal). 
                        // For tools (un), it should be Quantity * AvgPrice.
                    }
                }
            },
            {
                $project: {
                    code: 1,
                    description: 1,
                    totalWeight: 1,
                    totalQuantity: 1,
                    'financial.averagePrice': 1,
                    valuation: {
                        $cond: {
                            if: { $eq: ['$stockConfig.unit', 'un'] },
                            then: { $multiply: ['$totalQuantity', '$financial.averagePrice'] },
                            else: { $multiply: ['$totalWeight', '$financial.averagePrice'] }
                        }
                    }
                }
            }
        ]);

        const totalValue = inventory.reduce((sum, item) => sum + item.valuation, 0);

        res.status(200).json({
            success: true,
            totalValue,
            data: inventory
        });

    } catch (error) {
        console.error('Valuation Error:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar valorização de stock' });
    }
};

/**
 * @desc    Get Project Cost Report
 * @route   GET /api/reports/project/:projectRef
 * @access  Private (Manager/Admin)
 */
exports.getProjectCost = async (req, res) => {
    try {
        const { projectRef } = req.params;

        // 1. Find all movements for this project
        const movements = await Movement.aggregate([
            {
                $match: {
                    projectRef: { $regex: new RegExp(projectRef, 'i') }, // Case insensitive search
                    type: { $in: ['OUT', 'CUT'] } // Only Outgoing items count as cost
                }
            },
            {
                $lookup: {
                    from: 'products',
                    localField: 'product',
                    foreignField: '_id',
                    as: 'productDetails'
                }
            },
            {
                $unwind: '$productDetails'
            },
            {
                $project: {
                    date: 1,
                    type: 1,
                    quantityDelta: 1,
                    unit: 1,
                    costSnapshot: 1,
                    totalCost: 1,
                    projectRef: 1,
                    productCode: '$productDetails.code',
                    productDesc: '$productDetails.description'
                }
            },
            {
                $sort: { date: -1 }
            }
        ]);

        if (!movements || movements.length === 0) {
            return res.status(404).json({ success: false, message: 'Nenhum movimento encontrado para esta obra.' });
        }

        // 2. Calculate Totals
        const totalCost = movements.reduce((sum, m) => sum + (m.totalCost || 0), 0);

        // 3. Group by Material Type (Optional - for charts later)
        // const costByMaterial = ...

        res.status(200).json({
            success: true,
            projectRef: projectRef.toUpperCase(),
            totalCost,
            movementsCount: movements.length,
            data: movements
        });

    } catch (error) {
        console.error('Project Report Error:', error);
        res.status(500).json({ success: false, error: 'Erro ao gerar relatório de obra' });
    }
};

/**
 * @desc    Check stock levels and trigger alerts
 * @route   POST /api/reports/check-stock-alerts
 * @access  Private (Admin/Manager)
 */
exports.checkStockAlerts = async (req, res) => {
    try {
        const { checkStockLevels, getLowStockProducts } = require('../services/stockAlertService');

        // Run the stock level check
        const result = await checkStockLevels();

        // Get current low stock products
        const lowStockProducts = await getLowStockProducts();

        res.status(200).json({
            success: true,
            message: 'Níveis de stock verificados',
            lowStockCount: lowStockProducts.length,
            lowStockProducts
        });
    } catch (error) {
        console.error('Check Stock Alerts Error:', error);
        res.status(500).json({ success: false, error: 'Erro ao verificar alertas de stock' });
    }
};

/**
 * @desc    Get all products with current stock (for project material selection)
 * @route   GET /api/reports/products-stock
 * @access  Private
 */
exports.getProductsWithStock = async (req, res) => {
    try {
        const { search } = req.query;

        const productsWithStock = await Product.aggregate([
            {
                $lookup: {
                    from: 'stockitems',
                    localField: '_id',
                    foreignField: 'product',
                    as: 'stockItems'
                }
            },
            {
                $addFields: {
                    stockItems: {
                        $filter: {
                            input: '$stockItems',
                            as: 'item',
                            cond: { $eq: ['$$item.status', 'available'] }
                        }
                    }
                }
            },
            {
                $addFields: {
                    currentStock: {
                        $reduce: {
                            input: '$stockItems',
                            initialValue: 0,
                            in: {
                                $cond: [
                                    { $eq: ['$stockConfig.unit', 'kg'] },
                                    { $add: ['$$value', '$$this.calculatedWeight'] },
                                    { $add: ['$$value', '$$this.quantity'] }
                                ]
                            }
                        }
                    }
                }
            },
            {
                $match: search ? {
                    $or: [
                        { code: { $regex: search, $options: 'i' } },
                        { description: { $regex: search, $options: 'i' } }
                    ]
                } : {}
            },
            {
                $match: {
                    currentStock: { $gt: 0 },
                    active: true
                }
            },
            {
                $project: {
                    _id: 1,
                    code: 1,
                    description: 1,
                    materialType: 1,
                    currentStock: 1,
                    stockConfig: 1,
                    financial: 1
                }
            },
            { $sort: { code: 1 } },
            { $limit: 50 }
        ]);

        res.status(200).json({
            success: true,
            count: productsWithStock.length,
            data: productsWithStock
        });
    } catch (error) {
        console.error('GetProductsWithStock Error:', error);
        res.status(500).json({ success: false, error: 'Erro ao obter produtos' });
    }
};
