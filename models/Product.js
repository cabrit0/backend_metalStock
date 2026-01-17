const mongoose = require('mongoose');

/**
 * Product Schema - O Catálogo de Materiais
 * 
 * Define as regras do material (não a quantidade em stock).
 * Cada produto é um "tipo" de material com as suas propriedades físicas.
 */
const productSchema = new mongoose.Schema({
    // Identificação
    code: {
        type: String,
        required: [true, 'Código é obrigatório'],
        unique: true,
        uppercase: true,
        trim: true,
        index: true
    },
    description: {
        type: String,
        required: [true, 'Descrição é obrigatória'],
        trim: true
    },

    // Classificação
    category: {
        type: String,
        enum: ['raw_material', 'consumable', 'tool', 'misc'],
        default: 'raw_material'
    },
    materialType: {
        type: String,
        enum: ['steel', 'stainless', 'aluminum', 'brass', 'bronze', 'plastic', 'other'],
        default: 'steel'
    },
    shape: {
        type: String,
        enum: ['round', 'hex', 'tube', 'plate', 'box', 'other'],
        default: 'round'
    },

    // Dimensões (em mm)
    dimensions: {
        d: { type: Number, default: 0 },      // Diâmetro (para barras redondas/hex)
        w: { type: Number, default: 0 },      // Largura (para chapas/caixas)
        h: { type: Number, default: 0 },      // Altura/Espessura
        wall: { type: Number, default: 0 }    // Parede (para tubos)
    },

    // Propriedades Físicas (CRÍTICO para conversão Kg <-> Metros)
    density: {
        type: Number,
        default: 7.85,  // Aço padrão: 7.85 g/cm³
        min: [0.1, 'Densidade inválida']
    },

    // Peso unitário por metro (kg/m) - vem do Excel
    weightPerMeter: {
        type: Number,
        default: 0
    },

    // Configuração de Stock
    stockConfig: {
        minStock: { type: Number, default: 0 },       // Semáforo Vermelho
        safetyStock: { type: Number, default: 0 },    // Semáforo Amarelo
        unit: {
            type: String,
            enum: ['kg', 'un', 'm', 'unid', 'lt'],  // Aceita mais formatos do Excel
            default: 'kg'
        }
    },

    // Financeiro
    financial: {
        lastPrice: { type: Number, default: 0 },      // Último preço de compra
        averagePrice: { type: Number, default: 0 }    // Preço Médio Ponderado
    },

    // Fornecedores
    suppliers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Supplier'
    }],

    // Metadata
    active: {
        type: Boolean,
        default: true
    },
    notes: {
        type: String,
        default: ''
    }
}, {
    timestamps: true
});

// Índices para pesquisa rápida
productSchema.index({ description: 'text' });
productSchema.index({ category: 1, materialType: 1 });

/**
 * Virtual para calcular stock total a partir dos StockItems
 */
productSchema.virtual('stockItems', {
    ref: 'StockItem',
    localField: '_id',
    foreignField: 'product'
});

/**
 * Método para detetar tipo de material a partir da descrição
 */
productSchema.statics.detectMaterialType = function (description) {
    const desc = description.toLowerCase();

    if (desc.includes('inox') || desc.includes('304') || desc.includes('316')) {
        return 'stainless';
    }
    if (desc.includes('alumin') || desc.includes('alu ')) {
        return 'aluminum';
    }
    if (desc.includes('latão') || desc.includes('latao') || desc.includes('brass')) {
        return 'brass';
    }
    if (desc.includes('bronze')) {
        return 'bronze';
    }
    if (desc.includes('nylon') || desc.includes('pvc') || desc.includes('teflon') || desc.includes('delrin')) {
        return 'plastic';
    }
    // Default: Aço
    return 'steel';
};

/**
 * Método para detetar forma a partir do código/descrição
 */
productSchema.statics.detectShape = function (code, description) {
    const desc = description.toLowerCase();
    const cd = code.toUpperCase();

    if (desc.includes('tubo') || cd.includes('TUB')) {
        return 'tube';
    }
    if (desc.includes('hex') || cd.includes('HEX')) {
        return 'hex';
    }
    if (desc.includes('chapa') || desc.includes('plate') || cd.includes('CHP')) {
        return 'plate';
    }
    if (desc.includes('quadrado') || desc.includes('caixa') || cd.includes('QUA')) {
        return 'box';
    }
    // Default: Redondo
    return 'round';
};

/**
 * Método para extrair diâmetro do código (ex: AC4R050 -> 50mm)
 */
productSchema.statics.extractDiameter = function (code) {
    // Padrão: últimos 3 dígitos geralmente são o diâmetro
    const match = code.match(/(\d{2,3})$/);
    if (match) {
        return parseInt(match[1], 10);
    }
    return 0;
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;
