#!/usr/bin/env node

const { Command } = require('commander');
const { CppGenerator } = require('../dist/generator');
const fs = require('fs');
const path = require('path');

const program = new Command();

program
  .name('ts-cpp-bridge')
  .description('TypeScript to C++ bridge generator for Node.js N-API')
  .version('1.0.0');

program
  .command('generate')
  .description('Generate C++ glue code from TypeScript decorators')
  .option('-i, --input <files...>', 'Input TypeScript files', ['src/**/*.ts'])
  .option('-o, --output <dir>', 'Output directory for generated C++ files', './src')
  .option('-t, --tsconfig <path>', 'Path to tsconfig.json', './tsconfig.json')
  .action((options) => {
    try {
      console.log('🚀 Starting ts-cpp-bridge code generation...');
      
      // Проверяем существование tsconfig.json
      const tsConfigPath = path.resolve(options.tsconfig);
      if (!fs.existsSync(tsConfigPath)) {
        console.warn(`⚠️  tsconfig.json not found at ${tsConfigPath}, proceeding without it`);
      }
      
      const generator = new CppGenerator(fs.existsSync(tsConfigPath) ? tsConfigPath : undefined);
      
      // Собираем список файлов для парсинга
      const inputFiles = [];
      for (const pattern of options.input) {
        if (pattern.includes('*')) {
          // Для простоты, пока обрабатываем только прямые пути
          console.warn(`⚠️  Glob patterns not yet supported: ${pattern}`);
          continue;
        }
        
        const filePath = path.resolve(pattern);
        if (fs.existsSync(filePath)) {
          inputFiles.push(filePath);
        } else {
          console.warn(`⚠️  File not found: ${filePath}`);
        }
      }
      
      if (inputFiles.length === 0) {
        console.error('❌ No input files found');
        process.exit(1);
      }
      
      console.log(`📂 Processing files: ${inputFiles.map(f => path.basename(f)).join(', ')}`);
      
      // Парсим файлы
      const parseResult = generator.parseFiles(inputFiles);
      
      console.log(`📊 Found ${parseResult.structs.length} structs and ${parseResult.exports.length} exports`);
      
      if (parseResult.structs.length > 0) {
        console.log('📋 Structs:');
        parseResult.structs.forEach(s => {
          console.log(`  - ${s.name} (${s.fields.length} fields)`);
        });
      }
      
      if (parseResult.exports.length > 0) {
        console.log('🔗 Exports:');
        parseResult.exports.forEach(e => {
          console.log(`  - ${e.className}::${e.name}(${e.paramType}) -> ${e.returnType}`);
        });
      }
      
      // Создаем выходную директорию
      const outputDir = path.resolve(options.output);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      // Генерируем C++ код
      generator.generateCppCode(parseResult, outputDir);
      
      console.log('✅ C++ code generation completed!');
      console.log(`📁 Generated files in: ${outputDir}`);
      console.log('   - generated_structs.hpp');
      console.log('   - generated_structs.cpp');
      console.log('   - generated_api.cpp');
      console.log('');
      console.log('🔧 Next steps:');
      console.log('   1. Implement the extern functions in your C++ files');
      console.log('   2. Add generated files to your binding.gyp');
      console.log('   3. Run npm run build');
      
    } catch (error) {
      console.error('❌ Error during code generation:', error.message);
      if (process.env.DEBUG) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  });

program.parse();
