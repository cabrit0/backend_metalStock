const XLSX = require('xlsx');
const Product = require('../models/Product');
const StockItem = require('../models/StockItem');

/**
 * Parse Excel file and import products/stock
 * Supports formats: .xlsx, .xls, .csv
 */
const parseExcelFile = async (buffer, options = {}) => {
    const {
        sheetIndex = 0,
        hasHeader = true,
        mapping = {}
    } = options;

    // Read workbook from buffer
    const workbook = XLSX.read(buffer, { type: 'buffer' });

    // Get first sheet (or specified sheet)
    const sheetName = workbook.SheetNames[sheetIndex];
    const worksheet = workbook.Sheets[sheetName];

    // Convert to JSON
    const jsonData = XLSX.utils.sheet_to_json(worksheet, {
        header: hasHeader ? undefined : 1,
        defval: ''
    });

    return {
        sheetName,
        totalRows: jsonData.length,
        data: jsonData,
        headers: jsonData.length > 0 ? Object.keys(jsonData[0]) : []
    };
};

/**
 * Import products from parsed Excel data
 */
const importProducts = async (data, columnMapping, userId) => {
    const results = {
        created: 0,
        updated: 0,
        errors: [],
        skipped: 0
    };

    for (let i = 0; i < data.length; i++) {
        const row = data[i];
        const rowNumber = i + 2; // +2 because Excel is 1-indexed and has header

        try {
            // Extract values using column mapping
            const code = String(row[columnMapping.code] || '').trim().toUpperCase();
            const description = String(row[columnMapping.description] || '').trim();

            if (!code) {
                results.skipped++;
                continue;
            }

            // Parse optional fields
            const weightPerMeter = parseFloat(row[columnMapping.weightPerMeter]) || 0;
            const currentStock = parseFloat(row[columnMapping.stock]) || 0;
            const minStock = parseFloat(row[columnMapping.minStock]) || 0;
            const safetyStock = parseFloat(row[columnMapping.safetyStock]) || minStock * 1.5;
            const lastPrice = parseFloat(row[columnMapping.price]) || 0;
            const unit = String(row[columnMapping.unit] || 'kg').toLowerCase();

            // Detect material type and shape from description
            const materialType = Product.detectMaterialType(description);
            const shape = Product.detectShape(code, description);
            const diameter = Product.extractDiameter(code);

            // Check if product exists
            let product = await Product.findOne({ code });

            if (product) {
                // Update existing product
                product.description = description || product.description;
                product.weightPerMeter = weightPerMeter || product.weightPerMeter;
                product.stockConfig.minStock = minStock || product.stockConfig.minStock;
                product.stockConfig.safetyStock = safetyStock || product.stockConfig.safetyStock;
                product.stockConfig.unit = unit;
                if (lastPrice > 0) {
                    product.financial.lastPrice = lastPrice;
                }
                await product.save();
                results.updated++;
            } else {
                // Create new product
                product = await Product.create({
                    code,
                    description: description || code,
                    materialType,
                    shape,
                    dimensions: { d: diameter },
                    weightPerMeter,
                    stockConfig: {
                        minStock,
                        safetyStock,
                        unit
                    },
                    financial: {
                        lastPrice,
                        averagePrice: lastPrice
                    }
                });
                results.created++;
            }

            // Create/update stock if stock value provided
            if (currentStock > 0) {
                // Check existing stock
                const existingStock = await StockItem.getTotalStock(product._id);
                const existingQty = existingStock.totalQuantity || 0;

                if (currentStock > existingQty) {
                    // Add new stock items
                    const toAdd = currentStock - existingQty;
                    await StockItem.create({
                        product: product._id,
                        type: 'FULL_BAR',
                        quantity: toAdd,
                        lengthMM: 6000,
                        status: 'available',
                        notes: `Importado de Excel`
                    });
                }
            }

        } catch (error) {
            results.errors.push({
                row: rowNumber,
                message: error.message,
                code: row[columnMapping.code] || 'N/A'
            });
        }
    }

    return results;
};

/**
 * Get column suggestions based on Excel headers
 */
const suggestColumnMapping = (headers) => {
    const mapping = {};
    const lowerHeaders = headers.map(h => String(h).toLowerCase());

    // Code column
    const codePatterns = ['codigo', 'código', 'code', 'ref', 'referencia', 'referência', 'sku'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (codePatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.code = headers[i];
            break;
        }
    }

    // Description column
    const descPatterns = ['descricao', 'descrição', 'description', 'nome', 'name', 'material'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (descPatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.description = headers[i];
            break;
        }
    }

    // Weight per meter
    const weightPatterns = ['peso', 'weight', 'kg/m', 'kgm', 'peso/m'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (weightPatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.weightPerMeter = headers[i];
            break;
        }
    }

    // Stock
    const stockPatterns = ['stock', 'quantidade', 'qty', 'qtd', 'quant'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (stockPatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.stock = headers[i];
            break;
        }
    }

    // Min stock
    const minPatterns = ['min', 'minimo', 'mínimo'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (minPatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.minStock = headers[i];
            break;
        }
    }

    // Price
    const pricePatterns = ['preco', 'preço', 'price', 'custo', 'cost', 'valor'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (pricePatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.price = headers[i];
            break;
        }
    }

    // Unit
    const unitPatterns = ['unidade', 'unit', 'un', 'uom'];
    for (let i = 0; i < lowerHeaders.length; i++) {
        if (unitPatterns.some(p => lowerHeaders[i].includes(p))) {
            mapping.unit = headers[i];
            break;
        }
    }

    return mapping;
};

module.exports = {
    parseExcelFile,
    importProducts,
    suggestColumnMapping
};
