/**
 * Script para analisar a estrutura do ficheiro Excel de inventário
 * Execute: node analyzeExcel.js
 */

const XLSX = require('xlsx');
const path = require('path');

// Caminho para o ficheiro Excel
const excelPath = path.join(__dirname, '..', 'Inventario2021.xlsx');

try {
    console.log('📂 A ler ficheiro:', excelPath);
    console.log('');

    // Ler o workbook
    const workbook = XLSX.readFile(excelPath);

    // Listar todas as folhas
    console.log('📋 Folhas encontradas:');
    workbook.SheetNames.forEach((name, i) => {
        console.log(`   ${i + 1}. ${name}`);
    });
    console.log('');

    // Para cada folha, mostrar as primeiras linhas
    workbook.SheetNames.forEach(sheetName => {
        console.log(`\n${'='.repeat(60)}`);
        console.log(`📊 Folha: "${sheetName}"`);
        console.log('='.repeat(60));

        const worksheet = workbook.Sheets[sheetName];
        const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

        if (data.length === 0) {
            console.log('   (Folha vazia)');
            return;
        }

        // Mostrar headers (primeira linha)
        console.log('\n📌 Colunas (Headers):');
        const headers = data[0];
        headers.forEach((header, i) => {
            console.log(`   ${String.fromCharCode(65 + i)}. ${header}`);
        });

        // Mostrar as primeiras 5 linhas de dados
        console.log('\n📄 Primeiras 5 linhas de dados:');
        const dataRows = data.slice(1, 6);
        dataRows.forEach((row, i) => {
            console.log(`\n   Linha ${i + 1}:`);
            row.forEach((cell, j) => {
                const header = headers[j] || `Col${j}`;
                console.log(`      ${header}: ${cell}`);
            });
        });

        console.log(`\n   Total de linhas: ${data.length - 1}`);
    });

} catch (error) {
    console.error('❌ Erro ao ler Excel:', error.message);
}
