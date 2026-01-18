const mongoose = require('mongoose');

/**
 * Project (Obra) Schema for MetalStock Pro
 * Comprehensive tracking of construction projects/jobs
 */
const projectSchema = new mongoose.Schema({
    // === IDENTIFICAÇÃO ===
    reference: {
        type: String,
        unique: true,
        required: true,
        trim: true,
        match: [/^OBR-\d{4}-\d{3}$/, 'Referência deve seguir formato OBR-YYYY-NNN']
    },
    name: {
        type: String,
        required: [true, 'Nome da obra é obrigatório'],
        trim: true,
        maxlength: 200
    },
    client: {
        type: String,
        required: [true, 'Nome do cliente é obrigatório'],
        trim: true,
        maxlength: 200
    },
    description: {
        type: String,
        maxlength: 2000
    },

    // === DATAS ===
    startDate: {
        type: Date,
        required: [true, 'Data de início é obrigatória']
    },
    endDate: {
        type: Date,
        required: [true, 'Data de fim prevista é obrigatória']
    },
    actualEndDate: {
        type: Date  // Preenchido quando obra é concluída
    },

    // === ESTADO ===
    status: {
        type: String,
        enum: ['draft', 'active', 'completed', 'on_hold', 'cancelled'],
        default: 'active'
    },

    // === ORÇAMENTO (Previsão) ===
    budget: {
        materials: { type: Number, default: 0 },
        labor: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    // === CUSTOS REAIS (Calculados automaticamente) ===
    costs: {
        materials: { type: Number, default: 0 },
        labor: { type: Number, default: 0 },
        other: { type: Number, default: 0 },
        total: { type: Number, default: 0 }
    },

    // === VALOR DE VENDA ===
    saleValue: {
        type: Number,
        default: 0
    },

    // === MÃO DE OBRA ===
    laborEntries: [{
        date: { type: Date, required: true },
        worker: { type: String, required: true },
        hours: { type: Number, required: true, min: 0 },
        hourlyRate: { type: Number, required: true, min: 0 },
        description: { type: String, default: '' },
        totalCost: { type: Number, default: 0 }
    }],

    // === OUTROS CUSTOS ===
    otherCosts: [{
        date: { type: Date, default: Date.now },
        description: { type: String, required: true },
        amount: { type: Number, required: true }
    }],

    // === REFERÊNCIAS ===
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },

    // === NOTAS ===
    notes: {
        type: String,
        maxlength: 5000
    }
}, {
    timestamps: true
});

// Índices
projectSchema.index({ reference: 1 });
projectSchema.index({ name: 'text', client: 'text' });
projectSchema.index({ status: 1, createdAt: -1 });
projectSchema.index({ startDate: 1, endDate: 1 });

/**
 * Virtual: Lista de materiais associados
 */
projectSchema.virtual('materials', {
    ref: 'ProjectMaterial',
    localField: '_id',
    foreignField: 'project'
});

/**
 * Pre-save: Calcular totais
 */
projectSchema.pre('save', function () {
    // Calcular custo de mão de obra
    if (this.laborEntries && this.laborEntries.length > 0) {
        this.costs.labor = this.laborEntries.reduce((sum, entry) => {
            entry.totalCost = entry.hours * entry.hourlyRate;
            return sum + entry.totalCost;
        }, 0);
    }

    // Calcular outros custos
    if (this.otherCosts && this.otherCosts.length > 0) {
        this.costs.other = this.otherCosts.reduce((sum, entry) => sum + entry.amount, 0);
    }

    // Calcular custo total
    this.costs.total = (this.costs.materials || 0) + (this.costs.labor || 0) + (this.costs.other || 0);

    // Calcular orçamento total
    this.budget.total = (this.budget.materials || 0) + (this.budget.labor || 0) + (this.budget.other || 0);
});

/**
 * Static: Gerar próxima referência
 */
projectSchema.statics.generateReference = async function () {
    const currentYear = new Date().getFullYear();
    const prefix = `OBR-${currentYear}-`;

    // Buscar última obra deste ano
    const lastProject = await this.findOne({
        reference: { $regex: `^${prefix}` }
    }).sort({ reference: -1 });

    let sequence = 1;
    if (lastProject) {
        const lastNumber = parseInt(lastProject.reference.split('-')[2], 10);
        sequence = lastNumber + 1;
    }

    return `${prefix}${String(sequence).padStart(3, '0')}`;
};

/**
 * Static: Obter estatísticas de uma obra
 */
projectSchema.statics.getStats = async function (projectId) {
    const project = await this.findById(projectId);
    if (!project) return null;

    const margin = project.saleValue - project.costs.total;
    const marginPercent = project.saleValue > 0 ? (margin / project.saleValue) * 100 : 0;
    const budgetUsedPercent = project.budget.total > 0 ? (project.costs.total / project.budget.total) * 100 : 0;

    // Calcular dias
    const startDate = new Date(project.startDate);
    const endDate = project.actualEndDate ? new Date(project.actualEndDate) : new Date(project.endDate);
    const daysPlanned = Math.ceil((new Date(project.endDate) - startDate) / (1000 * 60 * 60 * 24));
    const daysActual = Math.ceil((endDate - startDate) / (1000 * 60 * 60 * 24));

    return {
        budget: project.budget,
        costs: project.costs,
        saleValue: project.saleValue,
        margin,
        marginPercent: Math.round(marginPercent * 10) / 10,
        budgetUsedPercent: Math.round(budgetUsedPercent * 10) / 10,
        daysPlanned,
        daysActual,
        laborHours: project.laborEntries.reduce((sum, e) => sum + e.hours, 0),
        isOverBudget: project.costs.total > project.budget.total,
        isProfitable: margin > 0
    };
};

const Project = mongoose.model('Project', projectSchema);

module.exports = Project;
