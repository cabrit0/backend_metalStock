/**
 * Script de Migração - Importar Inventário do Excel
 * 
 * Lê o ficheiro Inventario2021.xlsx e importa para o MongoDB:
 * - Cria Products (catálogo de materiais)
 * - Cria StockItems (stock inicial)
 * 
 * Execute: node migrate.js
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const XLSX = require('xlsx');
const path = require('path');

// Load environment variables
dotenv.config();

// Import models
const Product = require('./models/Product');
const StockItem = require('./models/StockItem');

// Caminho para o ficheiro Excel
const EXCEL_PATH = path.join(__dirname, '..', 'Inventario2021.xlsx');

// Densidades padrão por tipo de material (g/cm³)
const DENSITIES = {
    steel: 7.85,
    stainless: 7.90,
    aluminum: 2.70,
    brass: 8.50,
    bronze: 8.80,
    plastic: 1.20,
    other: 7.85
};

/**
 * Limpar e normalizar dados do Excel
 */
function cleanCell(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function cleanNumber(value) {
    if (value === undefined || value === null) return 0;
    const num = parseFloat(String(value).replace(',', '.'));
    return isNaN(num) ? 0 : num;
}

/**
 * Processar uma linha do Excel
 */
function processRow(row, headers) {
    // Mapear colunas (os headers têm quebras de linha)
    const data = {};
    headers.forEach((header, i) => {
        const key = header.replace(/\n/g, '').replace(/\s+/g, '');
        data[key] = row[i];
    });

    const code = cleanCell(data['ProductCode']);
    const description = cleanCell(data['ProductDescription']);
    const quantity = cleanNumber(data['ClosingStockQuantity']);
    const unit = cleanCell(data['UnitOfMeasure']);
    const weightPerUnit = cleanNumber(data['Pesounitário']);

    // Ignorar linhas sem código
    if (!code) return null;

    // Detetar tipo de material a partir da descrição
    const materialType = Product.detectMaterialType(description);

    // Detetar forma a partir do código/descrição
    const shape = Product.detectShape(code, description);

    // Extrair diâmetro do código (ex: AC4R050 -> 50mm)
    const diameter = Product.extractDiameter(code);

    return {
        code,
        description,
        quantity,
        unit: unit.toLowerCase() || 'kg',
        weightPerUnit,
        materialType,
        shape,
        diameter,
        density: DENSITIES[materialType] || DENSITIES.steel
    };
}

/**
 * Migração principal
 */
async function migrate() {
    console.log('🚀 MetalStock Pro - Script de Migração');
    console.log('='.repeat(50));

    try {
        // Conectar ao MongoDB
        console.log('\n🔌 A conectar ao MongoDB...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Conectado ao MongoDB');

        // Ler Excel
        console.log('\n📂 A ler ficheiro Excel...');
        const workbook = XLSX.readFile(EXCEL_PATH);
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        const headers = rawData[0];
        const dataRows = rawData.slice(1);
        console.log(`   Encontradas ${dataRows.length} linhas`);

        // Processar dados
        console.log('\n🔄 A processar dados...');
        const products = [];
        const errors = [];

        dataRows.forEach((row, index) => {
            try {
                const processed = processRow(row, headers);
                if (processed) {
                    products.push(processed);
                }
            } catch (error) {
                errors.push({ line: index + 2, error: error.message });
            }
        });

        console.log(`   ✅ ${products.length} produtos processados`);
        if (errors.length > 0) {
            console.log(`   ⚠️  ${errors.length} erros (ignorados)`);
        }

        // Limpar coleções existentes (opcional)
        console.log('\n🗑️  A limpar dados existentes...');
        const existingProducts = await Product.countDocuments();
        const existingStock = await StockItem.countDocuments();

        if (existingProducts > 0 || existingStock > 0) {
            console.log(`   Encontrados: ${existingProducts} produtos, ${existingStock} items de stock`);
            await Product.deleteMany({});
            await StockItem.deleteMany({});
            console.log('   ✅ Dados limpos');
        }

        // Inserir produtos e stock
        console.log('\n📦 A inserir produtos e stock...');
        let inserted = 0;
        let skipped = 0;

        for (const item of products) {
            try {
                // Criar produto
                const product = await Product.create({
                    code: item.code,
                    description: item.description,
                    category: 'raw_material',
                    materialType: item.materialType,
                    shape: item.shape,
                    dimensions: {
                        d: item.diameter,
                        w: 0,
                        h: 0,
                        wall: 0
                    },
                    density: item.density,
                    weightPerMeter: item.weightPerUnit,
                    stockConfig: {
                        minStock: 0,
                        safetyStock: 0,
                        unit: item.unit
                    }
                });

                // Criar stock item (se quantidade > 0)
                if (item.quantity > 0) {
                    await StockItem.create({
                        product: product._id,
                        type: 'BOX', // Importação inicial como BOX (unidades genéricas)
                        quantity: item.quantity,
                        lengthMM: 0, // Não sabemos o comprimento exato
                        calculatedWeight: item.quantity * item.weightPerUnit,
                        location: '',
                        status: 'available'
                    });
                }

                inserted++;
            } catch (error) {
                if (error.code === 11000) {
                    // Duplicado - ignorar
                    skipped++;
                } else {
                    console.error(`   ❌ Erro em ${item.code}:`, error.message);
                }
            }
        }

        // Resumo
        console.log('\n' + '='.repeat(50));
        console.log('📊 RESUMO DA MIGRAÇÃO');
        console.log('='.repeat(50));
        console.log(`   ✅ Produtos inseridos: ${inserted}`);
        console.log(`   ⏭️  Duplicados ignorados: ${skipped}`);
        console.log(`   📦 Stock items criados: ${await StockItem.countDocuments()}`);

        // Estatísticas por tipo de material
        console.log('\n📈 Por tipo de material:');
        const stats = await Product.aggregate([
            { $group: { _id: '$materialType', count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);
        stats.forEach(s => {
            console.log(`   • ${s._id}: ${s.count}`);
        });

    } catch (error) {
        console.error('\n❌ Erro na migração:', error);
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Desconectado do MongoDB');
        console.log('✅ Migração concluída!');
        process.exit(0);
    }
}

// Executar migração
migrate();
