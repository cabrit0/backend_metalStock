const mongoose = require('mongoose');

/**
 * Movement Schema - Histórico de Movimentos
 * 
 * Regista todas as entradas, saídas, cortes e ajustes de stock.
 * Fundamental para rastreabilidade e cálculo de custos por obra.
 */
const movementSchema = new mongoose.Schema({
    // Tipo de movimento
    type: {
        type: String,
        enum: ['IN', 'OUT', 'CUT', 'ADJUST'],
        required: [true, 'Tipo de movimento é obrigatório']
    },

    // Produto afetado
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Produto é obrigatório'],
        index: true
    },

    // Item de stock específico (opcional - para cortes)
    stockItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'StockItem'
    },

    // Utilizador que realizou o movimento
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: [true, 'Utilizador é obrigatório']
    },

    // Quantidade (positivo para IN, negativo para OUT)
    quantityDelta: {
        type: Number,
        required: [true, 'Quantidade é obrigatória']
    },

    // Unidade do movimento
    unit: {
        type: String,
        enum: ['kg', 'un', 'mm', 'm'],
        default: 'kg'
    },

    // Referência do projeto/obra/cliente
    projectRef: {
        type: String,
        default: '',
        trim: true,
        index: true
    },

    // Data do movimento (pode ser diferente de createdAt)
    date: {
        type: Date,
        default: Date.now,
        index: true
    },

    // Snapshot do custo no momento do movimento
    costSnapshot: {
        type: Number,
        default: 0
    },

    // Custo total deste movimento (quantidade × custo unitário)
    totalCost: {
        type: Number,
        default: 0
    },

    // Notas/Observações
    notes: {
        type: String,
        default: ''
    },

    // Para cortes: comprimento original e comprimento cortado
    cutDetails: {
        originalLengthMM: Number,
        cutLengthMM: Number,
        remainderLengthMM: Number,
        remainderAction: {
            type: String,
            enum: ['offcut', 'scrap', 'returned']
        }
    }
}, {
    timestamps: true
});

// Índices compostos para queries de relatórios
movementSchema.index({ product: 1, date: -1 });
movementSchema.index({ projectRef: 1, date: -1 });
movementSchema.index({ user: 1, date: -1 });
movementSchema.index({ type: 1, date: -1 });

/**
 * Pre-save: Calcular custo total
 */
movementSchema.pre('save', async function () {
    if (this.costSnapshot && this.quantityDelta) {
        this.totalCost = Math.abs(this.quantityDelta) * this.costSnapshot;
        this.totalCost = Math.round(this.totalCost * 100) / 100;
    }
});

/**
 * Static: Obter custo total de uma obra
 */
movementSchema.statics.getProjectCost = async function (projectRef) {
    const result = await this.aggregate([
        { $match: { projectRef, type: 'OUT' } },
        {
            $group: {
                _id: '$projectRef',
                totalCost: { $sum: '$totalCost' },
                totalMovements: { $sum: 1 }
            }
        }
    ]);

    return result[0] || { totalCost: 0, totalMovements: 0 };
};

/**
 * Static: Obter movimentos por período
 */
movementSchema.statics.getByPeriod = async function (startDate, endDate, type = null) {
    const query = {
        date: { $gte: startDate, $lte: endDate }
    };

    if (type) {
        query.type = type;
    }

    return this.find(query)
        .populate('product', 'code description')
        .populate('user', 'name')
        .sort({ date: -1 });
};

const Movement = mongoose.model('Movement', movementSchema);

module.exports = Movement;
