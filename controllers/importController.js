const multer = require('multer');
const { parseExcelFile, importProducts, suggestColumnMapping } = require('../services/excelImportService');

// Configure multer for memory storage (works on all platforms)
const storage = multer.memoryStorage();
const upload = multer({
    storage,
    limits: {
        fileSize: 10 * 1024 * 1024 // 10MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = [
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', // .xlsx
            'application/vnd.ms-excel', // .xls
            'text/csv', // .csv
            'application/csv'
        ];
        const allowedExts = ['.xlsx', '.xls', '.csv'];
        const ext = file.originalname.toLowerCase().slice(file.originalname.lastIndexOf('.'));

        if (allowedMimes.includes(file.mimetype) || allowedExts.includes(ext)) {
            cb(null, true);
        } else {
            cb(new Error('Formato de ficheiro não suportado. Use .xlsx, .xls ou .csv'));
        }
    }
});

/**
 * @desc    Preview Excel file (parse and show headers/data)
 * @route   POST /api/import/preview
 * @access  Private (Admin/Manager)
 */
const previewExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum ficheiro enviado'
            });
        }

        const result = await parseExcelFile(req.file.buffer);
        const suggestedMapping = suggestColumnMapping(result.headers);

        res.json({
            success: true,
            data: {
                fileName: req.file.originalname,
                sheetName: result.sheetName,
                totalRows: result.totalRows,
                headers: result.headers,
                suggestedMapping,
                preview: result.data.slice(0, 5) // First 5 rows as preview
            }
        });
    } catch (error) {
        console.error('Preview Excel Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao processar ficheiro'
        });
    }
};

/**
 * @desc    Import products from Excel
 * @route   POST /api/import/products
 * @access  Private (Admin/Manager)
 */
const importProductsFromExcel = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Nenhum ficheiro enviado'
            });
        }

        const { columnMapping } = req.body;

        if (!columnMapping || !columnMapping.code) {
            return res.status(400).json({
                success: false,
                message: 'Mapeamento de colunas obrigatório. Pelo menos a coluna "code" deve ser especificada.'
            });
        }

        // Parse the mapping if it's a string
        const mapping = typeof columnMapping === 'string'
            ? JSON.parse(columnMapping)
            : columnMapping;

        // Parse Excel file
        const parsed = await parseExcelFile(req.file.buffer);

        // Import products
        const results = await importProducts(parsed.data, mapping, req.user._id);

        res.json({
            success: true,
            message: `Importação concluída: ${results.created} criados, ${results.updated} atualizados`,
            data: results
        });
    } catch (error) {
        console.error('Import Products Error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Erro ao importar produtos'
        });
    }
};

/**
 * @desc    Get import template info
 * @route   GET /api/import/template
 * @access  Private
 */
const getTemplateInfo = async (req, res) => {
    res.json({
        success: true,
        data: {
            requiredColumns: ['Código', 'Descrição'],
            optionalColumns: ['Peso/Metro (kg)', 'Stock', 'Stock Mínimo', 'Preço', 'Unidade'],
            supportedFormats: ['.xlsx', '.xls', '.csv'],
            maxFileSize: '10MB',
            example: {
                'Código': 'AC4R050',
                'Descrição': 'Aço C45 Redondo 50mm',
                'Peso/Metro (kg)': 15.42,
                'Stock': 100,
                'Stock Mínimo': 10,
                'Preço': 2.50,
                'Unidade': 'kg'
            }
        }
    });
};

module.exports = {
    upload,
    previewExcel,
    importProductsFromExcel,
    getTemplateInfo
};
