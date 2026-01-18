const mongoose = require('mongoose');

/**
 * ProjectMaterial Schema - Materiais associados a uma Obra
 * 
 * Regista cada material usado numa obra com rastreabilidade completa.
 * Quando criado, decrementa automaticamente o stock.
 */
const projectMaterialSchema = new mongoose.Schema({
    // Referência à obra
    project: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Project',
        required: [true, 'Projeto é obrigatório'],
        index: true
    },

    // Produto do catálogo
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Produto é obrigatório']
    },

    // Item de stock específico (para barras/retalhos)
    stockItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockItem'
    },

    // Quantidade usada
    quantity: {
        type: Number,
        required: [true, 'Quantidade é obrigatória'],
        min: [0.001, 'Quantidade deve ser positiva']
    },

    // Unidade
    unit: {
        type: String,
        enum: ['kg', 'mm', 'm', 'un'],
        default: 'kg'
    },

    // Custos
    unitCost: {
        type: Number,
        required: true,
        min: 0
    },
    totalCost: {
        type: Number,
        default: 0
    },

    // Rastreabilidade
    addedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    addedAt: {
        type: Date,
        default: Date.now
    },

    // Movimento associado (para possível reversão)
    movement: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Movement'
    },

    // Notas
    notes: {
        type: String,
        maxlength: 500
    }
}, {
    timestamps: true
});

// Índices
projectMaterialSchema.index({ project: 1, product: 1 });
projectMaterialSchema.index({ addedAt: -1 });

/**
 * Pre-save: Calcular custo total
 */
projectMaterialSchema.pre('save', function () {
    this.totalCost = Math.round(this.quantity * this.unitCost * 100) / 100;
});

/**
 * Static: Obter total de materiais por obra
 */
projectMaterialSchema.statics.getProjectTotals = async function (projectId) {
    const result = await this.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId) } },
        {
            $group: {
                _id: '$project',
                totalCost: { $sum: '$totalCost' },
                materialCount: { $sum: 1 }
            }
        }
    ]);

    return result[0] || { totalCost: 0, materialCount: 0 };
};

/**
 * Static: Agrupar materiais por tipo
 */
projectMaterialSchema.statics.getMaterialsByType = async function (projectId) {
    return this.aggregate([
        { $match: { project: new mongoose.Types.ObjectId(projectId) } },
        {
            $lookup: {
                from: 'products',
                localField: 'product',
                foreignField: '_id',
                as: 'productInfo'
            }
        },
        { $unwind: '$productInfo' },
        {
            $group: {
                _id: '$productInfo.materialType',
                totalCost: { $sum: '$totalCost' },
                items: { $push: { code: '$productInfo.code', description: '$productInfo.description', quantity: '$quantity', cost: '$totalCost' } }
            }
        }
    ]);
};

const ProjectMaterial = mongoose.model('ProjectMaterial', projectMaterialSchema);

module.exports = ProjectMaterial;
