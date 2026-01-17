const mongoose = require('mongoose');

/**
 * StockItem Schema - O Inventário Físico
 * 
 * Cada barra, retalho ou caixa é um documento.
 * Separado do Product para permitir gestão de retalhos.
 */
const stockItemSchema = new mongoose.Schema({
    // Referência ao produto (catálogo)
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: [true, 'Produto é obrigatório'],
        index: true
    },

    // Tipo de item
    type: {
        type: String,
        enum: ['FULL_BAR', 'OFFCUT', 'BOX'],
        default: 'FULL_BAR'
    },

    // Quantidade (número de itens deste tamanho)
    quantity: {
        type: Number,
        required: [true, 'Quantidade é obrigatória'],
        min: [0, 'Quantidade não pode ser negativa'],
        default: 1
    },

    // Comprimento em mm (para barras e retalhos)
    lengthMM: {
        type: Number,
        default: 6000,  // Barra padrão: 6 metros
        min: [0, 'Comprimento não pode ser negativo']
    },

    // Peso calculado automaticamente (kg)
    calculatedWeight: {
        type: Number,
        default: 0
    },

    // Localização física no armazém
    location: {
        type: String,
        default: '',
        trim: true
    },

    // Rastreabilidade
    batchId: {
        type: String,
        default: '',
        trim: true
    },

    // Estado do item
    status: {
        type: String,
        enum: ['available', 'reserved', 'consumed'],
        default: 'available'
    },

    // Notas
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Índices compostos
stockItemSchema.index({ product: 1, type: 1 });
stockItemSchema.index({ product: 1, status: 1 });

/**
 * Pre-save: Calcular peso automaticamente
 */
stockItemSchema.pre('save', async function () {
    if (this.isModified('quantity') || this.isModified('lengthMM') || this.isNew) {
        await this.calculateWeight();
    }
});

/**
 * Calcular peso baseado no produto e comprimento
 */
stockItemSchema.methods.calculateWeight = async function () {
    try {
        await this.populate('product');

        if (this.product && this.product.weightPerMeter > 0) {
            // Peso = (comprimento em metros) × peso por metro × quantidade
            const lengthMeters = this.lengthMM / 1000;
            this.calculatedWeight = lengthMeters * this.product.weightPerMeter * this.quantity;
            this.calculatedWeight = Math.round(this.calculatedWeight * 100) / 100;
        }
    } catch (error) {
        console.error('Erro ao calcular peso:', error);
    }
};

/**
 * Static: Obter stock total de um produto
 */
stockItemSchema.statics.getTotalStock = async function (productId) {
    const result = await this.aggregate([
        { $match: { product: productId, status: 'available' } },
        {
            $group: {
                _id: '$product',
                totalQuantity: { $sum: '$quantity' },
                totalWeight: { $sum: '$calculatedWeight' },
                totalLength: { $sum: { $multiply: ['$quantity', '$lengthMM'] } }
            }
        }
    ]);

    return result[0] || { totalQuantity: 0, totalWeight: 0, totalLength: 0 };
};

/**
 * Static: Encontrar retalhos disponíveis para um comprimento mínimo
 */
stockItemSchema.statics.findOffcuts = async function (productId, minLengthMM) {
    return this.find({
        product: productId,
        type: 'OFFCUT',
        status: 'available',
        lengthMM: { $gte: minLengthMM }
    }).sort({ lengthMM: 1 }); // Menor primeiro (usar o mais ajustado)
};

const StockItem = mongoose.model('StockItem', stockItemSchema);

module.exports = StockItem;
