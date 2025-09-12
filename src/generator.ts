import { Project, ClassDeclaration, MethodDeclaration, PropertyDeclaration, SyntaxKind } from 'ts-morph';
import * as fs from 'fs';
import * as path from 'path';
import { getCppType, getNapiType, getNapiExtractor, isPreciseNumericType } from './numeric-types';

/**
 * Информация о поле структуры, извлеченная из AST
 */
export interface ParsedField {
  name: string;
  type: string;
  isArray: boolean;
  isOptional: boolean;
}

/**
 * Информация о структуре, извлеченная из AST
 */
export interface ParsedStruct {
  name: string;
  fields: ParsedField[];
}

/**
 * Информация об экспортируемом методе, извлеченная из AST
 */
export interface ParsedExport {
  name: string;
  className: string;
  methodName: string;
  paramType: string;
  returnType: string;
  isStatic: boolean;
  parameters: { name: string; type: string }[];
}

/**
 * Результат парсинга проекта
 */
export interface ParseResult {
  structs: ParsedStruct[];
  exports: ParsedExport[];
}

/**
 * Генератор C++ кода из TypeScript AST
 */
export class CppGenerator {
  private project: Project;

  constructor(tsConfigPath?: string) {
    this.project = new Project({
      tsConfigFilePath: tsConfigPath,
      skipAddingFilesFromTsConfig: !tsConfigPath
    });
  }

  /**
   * Парсит TypeScript файлы и извлекает информацию о структурах и экспортах
   */
  public parseFiles(filePaths: string[]): ParseResult {
    const structs: ParsedStruct[] = [];
    const exports: ParsedExport[] = [];

    for (const filePath of filePaths) {
      const sourceFile = this.project.addSourceFileAtPath(filePath);
      
      // Ищем классы с декоратором @CppStruct
      const classes = sourceFile.getClasses();
      
      for (const classDecl of classes) {
        const structInfo = this.parseStruct(classDecl);
        if (structInfo) {
          structs.push(structInfo);
        }

        const exportInfos = this.parseExports(classDecl);
        exports.push(...exportInfos);
      }
    }

    return { structs, exports };
  }

  /**
   * Парсит класс с декоратором @CppStruct
   */
  private parseStruct(classDecl: ClassDeclaration): ParsedStruct | null {
    const decorators = classDecl.getDecorators();
    const hasCppStruct = decorators.some(d => 
      d.getName() === 'CppStruct' || 
      d.getFullText().includes('@CppStruct')
    );

    if (!hasCppStruct) {
      return null;
    }

    const fields: ParsedField[] = [];
    const properties = classDecl.getProperties();

    for (const prop of properties) {
      const field = this.parseField(prop);
      if (field) {
        fields.push(field);
      }
    }

    return {
      name: classDecl.getName() || 'UnnamedStruct',
      fields
    };
  }

  /**
   * Парсит поле класса
   */
  private parseField(prop: PropertyDeclaration): ParsedField | null {
    const name = prop.getName();
    const typeNode = prop.getTypeNode();
    const isOptional = prop.hasQuestionToken();

    if (!typeNode) {
      return null;
    }

    const typeText = typeNode.getText();
    const isArray = typeText.includes('[]') || typeText.startsWith('Array<');
    
    // Извлекаем базовый тип из массива
    let baseType = typeText;
    if (isArray) {
      if (typeText.includes('[]')) {
        baseType = typeText.replace('[]', '');
      } else if (typeText.startsWith('Array<')) {
        baseType = typeText.slice(6, -1); // убираем Array< и >
      }
    }

    // Предупреждение о зарезервированных словах
    if (this.isReservedCppKeyword(name)) {
      console.warn(`⚠️  Field '${name}' is a C++ reserved keyword and will be renamed to '${name}_' in generated code`);
    }

    return {
      name,
      type: this.mapTypeScriptToCpp(baseType),
      isArray,
      isOptional
    };
  }

  /**
   * Парсит методы с декоратором @CppExport
   */
  private parseExports(classDecl: ClassDeclaration): ParsedExport[] {
    const exports: ParsedExport[] = [];
    const methods = classDecl.getMethods();
    const className = classDecl.getName() || 'UnnamedClass';

    for (const method of methods) {
      const decorators = method.getDecorators();
      const hasCppExport = decorators.some(d => 
        d.getName() === 'CppExport' || 
        d.getFullText().includes('@CppExport')
      );

      if (hasCppExport) {
        const exportInfo = this.parseExportMethod(method, className);
        if (exportInfo) {
          exports.push(exportInfo);
        }
      }
    }

    return exports;
  }

  /**
   * Парсит экспортируемый метод
   */
  private parseExportMethod(method: MethodDeclaration, className: string): ParsedExport | null {
    const methodName = method.getName();
    const parameters = method.getParameters();
    const returnType = method.getReturnTypeNode();
    const isStatic = method.isStatic();

    // Собираем информацию о параметрах
    const paramList: { name: string; type: string }[] = [];
    for (const param of parameters) {
      const paramName = param.getName();
      const paramTypeText = param.getTypeNode()?.getText() || 'any';
      const cppType = this.mapTypeScriptToCpp(paramTypeText);
      paramList.push({ name: paramName, type: cppType });
    }

    // Пока поддерживаем только один параметр
    const paramType = parameters.length > 0 
      ? this.mapTypeScriptToCpp(parameters[0].getTypeNode()?.getText() || 'void')
      : 'void';

    const returnTypeStr = returnType 
      ? this.mapTypeScriptToCpp(returnType.getText())
      : 'void';

    // Для static методов имя функции: ClassName_methodName
    const name = isStatic ? `${className}_${methodName}` : methodName;

    return {
      name,
      className,
      methodName,
      paramType,
      returnType: returnTypeStr,
      isStatic,
      parameters: paramList
    };
  }

  /**
   * Маппинг TypeScript типов в C++ типы
   */
  private mapTypeScriptToCpp(tsType: string): string {
    // Используем новую систему уточняемых типов
    const mappedType = getCppType(tsType);
    
    // Фолбэк для старых типов, если нет в новой системе
    if (mappedType === tsType) {
      const typeMap: { [key: string]: string } = {
        'number': 'int',  // по умолчанию для совместимости
        'void': 'void'
      };
      return typeMap[tsType] || tsType;
    }
    
    return mappedType;
  }

  /**
   * Проверяет, является ли идентификатор зарезервированным словом C++
   */
  private isReservedCppKeyword(name: string): boolean {
    const cppKeywords = [
      'auto', 'break', 'case', 'char', 'const', 'continue', 'default', 'do',
      'double', 'else', 'enum', 'extern', 'float', 'for', 'goto', 'if',
      'inline', 'int', 'long', 'register', 'restrict', 'return', 'short',
      'signed', 'sizeof', 'static', 'struct', 'switch', 'typedef', 'union',
      'unsigned', 'void', 'volatile', 'while', 'bool', 'catch', 'class',
      'const_cast', 'delete', 'dynamic_cast', 'explicit', 'export', 'false',
      'friend', 'mutable', 'namespace', 'new', 'operator', 'private',
      'protected', 'public', 'reinterpret_cast', 'static_cast', 'template',
      'this', 'throw', 'true', 'try', 'typeid', 'typename', 'using',
      'virtual', 'wchar_t'
    ];
    
    return cppKeywords.includes(name.toLowerCase());
  }

  /**
   * Преобразует имя поля, если оно конфликтует с C++ ключевыми словами
   */
  private sanitizeFieldName(name: string): string {
    if (this.isReservedCppKeyword(name)) {
      return name + '_'; // добавляем подчеркивание
    }
    return name;
  }

  /**
   * Генерирует C++ код из результатов парсинга
   */
  public generateCppCode(parseResult: ParseResult, outputDir: string): void {
    this.generateStructsHeader(parseResult.structs, outputDir);
    this.generateStructsImpl(parseResult.structs, outputDir);
    this.generateApiWrapper(parseResult.exports, outputDir);
    this.generateTypeScriptWrappers(parseResult, outputDir);
  }

  /**
   * Генерирует заголовочный файл структур
   */
  private generateStructsHeader(structs: ParsedStruct[], outputDir: string): void {
    const template = fs.readFileSync(
      path.join(__dirname, 'templates', 'structs.hpp.template'), 
      'utf-8'
    );

    let structDeclarations = '';
    
    for (const struct of structs) {
      structDeclarations += `\nstruct ${struct.name} {\n`;
      
      // Поля
      for (const field of struct.fields) {
        const cppType = field.isArray ? `std::vector<${field.type}>` : field.type;
        const sanitizedName = this.sanitizeFieldName(field.name);
        structDeclarations += `    ${cppType} ${sanitizedName};\n`;
      }
      
      // Методы
      structDeclarations += `    static ${struct.name} FromNapi(const Napi::Object& obj);\n`;
      structDeclarations += `    Napi::Object ToNapi(Napi::Env env) const;\n`;
      structDeclarations += `};\n`;
    }

    const output = template.replace('{{STRUCT_DECLARATIONS}}', structDeclarations);
    
    fs.writeFileSync(path.join(outputDir, 'generated_structs.hpp'), output);
  }

  /**
   * Генерирует реализацию структур
   */
  private generateStructsImpl(structs: ParsedStruct[], outputDir: string): void {
    const template = fs.readFileSync(
      path.join(__dirname, 'templates', 'structs.cpp.template'), 
      'utf-8'
    );

    let implementations = '';
    
    for (const struct of structs) {
      // FromNapi метод
      implementations += `\n${struct.name} ${struct.name}::FromNapi(const Napi::Object& obj) {\n`;
      implementations += `    ${struct.name} result;\n`;
      
      for (const field of struct.fields) {
        const sanitizedName = this.sanitizeFieldName(field.name);
        
        if (field.isArray) {
          implementations += `    if (obj.Has("${field.name}") && obj.Get("${field.name}").IsArray()) {\n`;
          implementations += `        Napi::Array arr = obj.Get("${field.name}").As<Napi::Array>();\n`;
          implementations += `        for (uint32_t i = 0; i < arr.Length(); i++) {\n`;
          
          if (field.type === 'std::string') {
            implementations += `            result.${sanitizedName}.push_back(arr.Get(i).As<Napi::String>().Utf8Value());\n`;
          } else if (field.type === 'int') {
            implementations += `            result.${sanitizedName}.push_back(arr.Get(i).As<Napi::Number>().Int32Value());\n`;
          } else if (field.type === 'bool') {
            implementations += `            result.${sanitizedName}.push_back(arr.Get(i).As<Napi::Boolean>().Value());\n`;
          }
          
          implementations += `        }\n`;
          implementations += `    }\n`;
        } else {
          implementations += `    if (obj.Has("${field.name}")) {\n`;
          
          if (field.type === 'std::string') {
            implementations += `        result.${sanitizedName} = obj.Get("${field.name}").As<Napi::String>().Utf8Value();\n`;
          } else if (field.type === 'int') {
            implementations += `        result.${sanitizedName} = obj.Get("${field.name}").As<Napi::Number>().Int32Value();\n`;
          } else if (field.type === 'bool') {
            implementations += `        result.${sanitizedName} = obj.Get("${field.name}").As<Napi::Boolean>().Value();\n`;
          }
          
          implementations += `    }\n`;
        }
      }
      
      implementations += `    return result;\n`;
      implementations += `}\n`;

      // ToNapi метод
      implementations += `\nNapi::Object ${struct.name}::ToNapi(Napi::Env env) const {\n`;
      implementations += `    Napi::Object obj = Napi::Object::New(env);\n`;
      
      for (const field of struct.fields) {
        const sanitizedName = this.sanitizeFieldName(field.name);
        
        if (field.isArray) {
          // Создаем уникальное имя для каждого массива
          const arrayVarName = `${sanitizedName}Arr`;
          implementations += `    Napi::Array ${arrayVarName} = Napi::Array::New(env, ${sanitizedName}.size());\n`;
          implementations += `    for (size_t i = 0; i < ${sanitizedName}.size(); i++) {\n`;
          
          if (field.type === 'std::string') {
            implementations += `        ${arrayVarName}.Set(i, Napi::String::New(env, ${sanitizedName}[i]));\n`;
          } else {
            implementations += `        ${arrayVarName}.Set(i, Napi::Number::New(env, ${sanitizedName}[i]));\n`;
          }
          
          implementations += `    }\n`;
          implementations += `    obj.Set("${field.name}", ${arrayVarName});\n`;
        } else {
          if (field.type === 'std::string') {
            implementations += `    obj.Set("${field.name}", Napi::String::New(env, ${sanitizedName}));\n`;
          } else if (field.type === 'int') {
            implementations += `    obj.Set("${field.name}", Napi::Number::New(env, ${sanitizedName}));\n`;
          } else if (field.type === 'bool') {
            implementations += `    obj.Set("${field.name}", Napi::Boolean::New(env, ${sanitizedName}));\n`;
          }
        }
      }
      
      implementations += `    return obj;\n`;
      implementations += `}\n`;
    }

    const output = template.replace('{{STRUCT_IMPLEMENTATIONS}}', implementations);
    
    fs.writeFileSync(path.join(outputDir, 'generated_structs.cpp'), output);
  }

  /**
   * Генерирует API wrapper
   */
  private generateApiWrapper(exports: ParsedExport[], outputDir: string): void {
    const template = fs.readFileSync(
      path.join(__dirname, 'templates', 'api.cpp.template'), 
      'utf-8'
    );

    let externDeclarations = '';
    let wrapperFunctions = '';
    let exportRegistrations = '';

    for (const exp of exports) {
      // Extern объявления
      externDeclarations += `extern ${exp.returnType} ${exp.name}(const ${exp.paramType}& param);\n`;
      
      // Wrapper функции
      wrapperFunctions += `\nNapi::Value ${exp.name}_wrapper(const Napi::CallbackInfo& info) {\n`;
      wrapperFunctions += `    Napi::Env env = info.Env();\n`;
      wrapperFunctions += `    \n`;
      wrapperFunctions += `    if (info.Length() < 1 || !info[0].IsObject()) {\n`;
      wrapperFunctions += `        Napi::TypeError::New(env, "Expected an object").ThrowAsJavaScriptException();\n`;
      wrapperFunctions += `        return env.Null();\n`;
      wrapperFunctions += `    }\n`;
      wrapperFunctions += `    \n`;
      wrapperFunctions += `    ${exp.paramType} input = ${exp.paramType}::FromNapi(info[0].As<Napi::Object>());\n`;
      wrapperFunctions += `    ${exp.returnType} result = ${exp.name}(input);\n`;
      wrapperFunctions += `    return result.ToNapi(env);\n`;
      wrapperFunctions += `}\n`;
      
      // Регистрация экспортов
      exportRegistrations += `    exports.Set("${exp.name}", Napi::Function::New(env, ${exp.name}_wrapper));\n`;
    }

    let output = template
      .replace('{{EXTERN_DECLARATIONS}}', externDeclarations)
      .replace('{{WRAPPER_FUNCTIONS}}', wrapperFunctions)
      .replace('{{EXPORT_REGISTRATIONS}}', exportRegistrations);

    fs.writeFileSync(path.join(outputDir, 'generated_api.cpp'), output);
  }

  /**
   * Генерирует TypeScript обертки для экспортов
   */
  private generateTypeScriptWrappers(parseResult: ParseResult, outputDir: string) {
    // Генерируем типы для addon
    this.generateAddonTypes(parseResult, outputDir);
    // Генерируем TypeScript API обертки
    this.generateTypeScriptAPI(parseResult, outputDir);
  }

  /**
   * Генерирует файл типов для addon (generated_addon.d.ts)
   */
  public generateAddonTypes(parseResult: ParseResult, outputDir: string) {
    let content = '// Автоматически сгенерированные типы для addon\n\n';

    // Генерируем интерфейсы для структур
    for (const struct of parseResult.structs) {
      content += `export interface ${struct.name} {\n`;
      for (const field of struct.fields) {
        const tsType = this.fieldToTSType(field, parseResult.structs);
        content += `  ${field.name}: ${tsType};\n`;
      }
      content += '}\n\n';
    }

    // Генерируем типы для экспортов addon
    content += 'export interface AddonExports {\n';
    for (const exp of parseResult.exports) {
      const inputType = exp.parameters.length > 0 ? exp.parameters[0].type : 'void';
      const outputType = exp.returnType;
      const inputTS = this.cppTypeToTS(inputType, parseResult.structs);
      const outputTS = this.cppTypeToTS(outputType, parseResult.structs);
      
      if (inputType === 'void') {
        content += `  ${exp.name}: () => ${outputTS};\n`;
      } else {
        content += `  ${exp.name}: (input: ${inputTS}) => ${outputTS};\n`;
      }
    }
    content += '}\n\n';

    content += 'declare const addon: AddonExports;\n';
    content += 'export default addon;\n';

    fs.writeFileSync(path.join(outputDir, 'generated_addon.d.ts'), content);
  }

  /**
   * Генерирует TypeScript API обертки (generated_api.ts)
   */
  public generateTypeScriptAPI(parseResult: ParseResult, outputDir: string) {
    // Собираем уникальные числовые типы для импорта
    const usedNumericTypes = new Set<string>();
    
    for (const struct of parseResult.structs) {
      for (const field of struct.fields) {
        const beautifulType = this.cppTypeToTSBeautiful(field.type, parseResult.structs);
        if (['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64', 'f32', 'f64'].includes(beautifulType)) {
          usedNumericTypes.add(beautifulType);
        }
      }
    }
    
    let content = '// Автоматически сгенерированные TypeScript обертки\n\n';
    
    content += '// Декларация для require\n';
    content += 'declare const require: any;\n\n';
    
    // Добавляем импорт числовых типов, если они используются
    if (usedNumericTypes.size > 0) {
      const typesList = Array.from(usedNumericTypes).sort().join(', ');
      content += `import { ${typesList} } from 'ts-cpp-bridge';\n\n`;
    }

    // Определяем типы локально в этом файле с красивыми типами
    for (const struct of parseResult.structs) {
      content += `export interface ${struct.name} {\n`;
      for (const field of struct.fields) {
        const tsType = this.fieldToTSTypeBeautiful(field, parseResult.structs);
        content += `  ${field.name}: ${tsType};\n`;
      }
      content += '}\n\n';
    }

    // Объявляем низкоуровневые типы для addon (только number вместо красивых типов)
    content += '// Низкоуровневые типы для C++ addon\n';
    for (const struct of parseResult.structs) {
      content += `interface ${struct.name}Native {\n`;
      for (const field of struct.fields) {
        const tsType = this.fieldToTSType(field, parseResult.structs);
        content += `  ${field.name}: ${tsType};\n`;
      }
      content += '}\n\n';
    }

    // Объявляем нативный addon
    content += 'interface AddonExports {\n';
    for (const exp of parseResult.exports) {
      const inputType = exp.parameters.length > 0 ? exp.parameters[0].type : 'void';
      const outputType = exp.returnType;
      const inputTS = this.cppTypeToTS(inputType, parseResult.structs);
      const outputTS = this.cppTypeToTS(outputType, parseResult.structs);
      
      if (inputType === 'void') {
        content += `  ${exp.name}: () => ${outputTS}Native;\n`;
      } else {
        content += `  ${exp.name}: (input: ${inputTS}Native) => ${outputTS}Native;\n`;
      }
    }
    content += '}\n\n';

    content += '// Импорт нативного addon\n';
    content += 'const addon: AddonExports = (() => {\n';
    content += '  try {\n';
    content += '    return require(\'../../build/Release/addon\');\n';
    content += '  } catch (e) {\n';
    content += '    throw new Error(\'Native addon not found. Run npm run build:native first.\');\n';
    content += '  }\n';
    content += '})();\n\n';

    // Добавляем функции преобразования типов
    content += '// Функции преобразования типов\n';
    for (const struct of parseResult.structs) {
      // Функция из красивых типов в нативные
      content += `function to${struct.name}Native(input: ${struct.name}): ${struct.name}Native {\n`;
      content += `  return input as any; // Типы совместимы на runtime\n`;
      content += `}\n\n`;
      
      // Функция из нативных в красивые типы
      content += `function from${struct.name}Native(input: ${struct.name}Native): ${struct.name} {\n`;
      content += `  return input as any; // Типы совместимы на runtime\n`;
      content += `}\n\n`;
    }
    content += '\n';

    // Группируем экспорты по классам и свободным функциям
    const classMethods = new Map<string, ParsedExport[]>();
    const freeFunctions: ParsedExport[] = [];

    for (const exp of parseResult.exports) {
      if (exp.className && exp.isStatic) {
        if (!classMethods.has(exp.className)) {
          classMethods.set(exp.className, []);
        }
        classMethods.get(exp.className)!.push(exp);
      } else if (!exp.className) {
        freeFunctions.push(exp);
      }
    }

    // Генерируем классы с статическими методами
    for (const [className, methods] of classMethods) {
      content += `export class ${className} {\n`;
      for (const method of methods) {
        const inputType = method.parameters.length > 0 ? method.parameters[0].type : 'void';
        const outputType = method.returnType;
        const inputTS = this.cppTypeToTSBeautiful(inputType, parseResult.structs);
        const outputTS = this.cppTypeToTSBeautiful(outputType, parseResult.structs);
        
        if (inputType === 'void') {
          content += `  static ${method.methodName}(): ${outputTS} {\n`;
          content += `    const result = addon.${method.name}();\n`;
          content += `    return from${outputType}Native(result);\n`;
          content += `  }\n\n`;
        } else {
          content += `  static ${method.methodName}(input: ${inputTS}): ${outputTS} {\n`;
          content += `    const nativeInput = to${inputType}Native(input);\n`;
          content += `    const result = addon.${method.name}(nativeInput);\n`;
          content += `    return from${outputType}Native(result);\n`;
          content += `  }\n\n`;
        }
      }
      content += '}\n\n';
    }

    // Генерируем свободные функции
    for (const func of freeFunctions) {
      const inputType = func.parameters.length > 0 ? func.parameters[0].type : 'void';
      const outputType = func.returnType;
      const inputTS = this.cppTypeToTSBeautiful(inputType, parseResult.structs);
      const outputTS = this.cppTypeToTSBeautiful(outputType, parseResult.structs);
      
      if (inputType === 'void') {
        content += `export function ${func.name}(): ${outputTS} {\n`;
        content += `  const result = addonTyped.${func.name}();\n`;
        content += `  return from${outputType}Native(result);\n`;
        content += `}\n\n`;
      } else {
        content += `export function ${func.name}(input: ${inputTS}): ${outputTS} {\n`;
        content += `  const nativeInput = to${inputType}Native(input);\n`;
        content += `  const result = addonTyped.${func.name}(nativeInput);\n`;
        content += `  return from${outputType}Native(result);\n`;
        content += `}\n\n`;
      }
    }

    fs.writeFileSync(path.join(outputDir, 'generated_api.ts'), content);
  }

  /**
   * Преобразует поле структуры в красивый TypeScript тип (для generated_api.ts)
   */
  private fieldToTSTypeBeautiful(field: ParsedField, structs: ParsedStruct[]): string {
    let baseType = this.cppTypeToTSBeautiful(field.type, structs);
    
    if (field.isArray) {
      baseType += '[]';
    }
    
    if (field.isOptional) {
      baseType += ' | undefined';
    }
    
    return baseType;
  }

  /**
   * Преобразует поле структуры в TypeScript тип
   */
  private fieldToTSType(field: ParsedField, structs: ParsedStruct[]): string {
    let baseType = this.cppTypeToTS(field.type, structs);
    
    if (field.isArray) {
      baseType += '[]';
    }
    
    if (field.isOptional) {
      baseType += ' | undefined';
    }
    
    return baseType;
  }

  /**
   * Преобразует C++ тип в красивый TypeScript тип (для generated_api.ts)
   */
  private cppTypeToTSBeautiful(cppType: string, structs: ParsedStruct[]): string {
    // Удаляем const и пробелы
    cppType = cppType.replace(/const\s+/g, '').trim();
    
    // Красивые числовые типы
    const beautifulTypeMap: { [key: string]: string } = {
      'int': 'number',
      'double': 'f64',
      'float': 'f32',
      'bool': 'boolean',
      'string': 'string',
      'std::string': 'string',
      'void': 'void',
      // Точные числовые типы
      'int8_t': 'i8',
      'uint8_t': 'u8', 
      'int16_t': 'i16',
      'uint16_t': 'u16',
      'int32_t': 'i32',
      'uint32_t': 'u32',
      'int64_t': 'i64',
      'uint64_t': 'u64',
      'float32_t': 'f32',
      'float64_t': 'f64'
    };

    if (beautifulTypeMap[cppType]) {
      return beautifulTypeMap[cppType];
    }

    // Проверяем, есть ли такая структура
    const structExists = structs.some(s => s.name === cppType);
    if (structExists) {
      return cppType;
    }

    // По умолчанию используем обычное преобразование
    return this.cppTypeToTS(cppType, structs);
  }

  /**
   * Преобразует C++ тип в TypeScript тип
   */
  private cppTypeToTS(cppType: string, structs: ParsedStruct[]): string {
    // Удаляем const и пробелы
    cppType = cppType.replace(/const\s+/g, '').trim();
    
    // Базовые типы
    const typeMap: { [key: string]: string } = {
      'int': 'number',
      'double': 'number',
      'float': 'number',
      'bool': 'boolean',
      'string': 'string',
      'std::string': 'string',
      'void': 'void',
      // Точные числовые типы
      'int8_t': 'number',
      'uint8_t': 'number', 
      'int16_t': 'number',
      'uint16_t': 'number',
      'int32_t': 'number',
      'uint32_t': 'number',
      'int64_t': 'number',
      'uint64_t': 'number',
      'float32_t': 'number',
      'float64_t': 'number',
      // Алиасы для удобства
      'i8': 'number',
      'u8': 'number',
      'i16': 'number', 
      'u16': 'number',
      'i32': 'number',
      'u32': 'number',
      'i64': 'number',
      'u64': 'number',
      'f32': 'number',
      'f64': 'number'
    };

    if (typeMap[cppType]) {
      return typeMap[cppType];
    }

    // Проверяем, есть ли такая структура
    const structExists = structs.some(s => s.name === cppType);
    if (structExists) {
      return cppType;
    }

    // По умолчанию возвращаем any для неизвестных типов
    console.warn(`Warning: Unknown C++ type '${cppType}', using 'any'`);
    return 'any';
  }
}
