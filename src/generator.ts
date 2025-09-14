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
  tsType: string;  // Добавляем оригинальный TypeScript тип
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
  isAsync: boolean;  // Новое поле для асинхронных методов
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
      tsType: baseType,  // Сохраняем оригинальный TypeScript тип
      isArray,
      isOptional
    };
  }

  /**
   * Парсит методы с декоратором @CppExport или @CppAsync
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
      const hasCppAsync = decorators.some(d => 
        d.getName() === 'CppAsync' || 
        d.getFullText().includes('@CppAsync')
      );

      if (hasCppExport || hasCppAsync) {
        const exportInfo = this.parseExportMethod(method, className, hasCppAsync);
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
  private parseExportMethod(method: MethodDeclaration, className: string, isAsync: boolean = false): ParsedExport | null {
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
      isAsync,
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
    this.generateImplementationTemplate(parseResult.exports, outputDir);
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
          
          // Используем функции из numeric-types для правильной генерации
          const extractor = getNapiExtractor(field.tsType);
          if (extractor !== '.As<Napi::Value>()') {
            // Это известный тип, используем правильный экстрактор
            if (isPreciseNumericType(field.tsType)) {
              // Для семантических типов нужно кастовать к правильному C++ типу
              const cppType = getCppType(field.tsType);
              implementations += `        result.${sanitizedName} = static_cast<${cppType}>(obj.Get("${field.name}")${extractor});\n`;
            } else {
              implementations += `        result.${sanitizedName} = obj.Get("${field.name}")${extractor};\n`;
            }
          } else {
            // Fallback для неизвестных типов
            if (field.type === 'std::string') {
              implementations += `        result.${sanitizedName} = obj.Get("${field.name}").As<Napi::String>().Utf8Value();\n`;
            } else if (field.type === 'int') {
              implementations += `        result.${sanitizedName} = obj.Get("${field.name}").As<Napi::Number>().Int32Value();\n`;
            } else if (field.type === 'bool') {
              implementations += `        result.${sanitizedName} = obj.Get("${field.name}").As<Napi::Boolean>().Value();\n`;
            }
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
          // Используем функции из numeric-types для правильной генерации
          if (isPreciseNumericType(field.tsType)) {
            // Для семантических типов нужно кастовать к правильному типу для N-API
            implementations += `    obj.Set("${field.name}", Napi::Number::New(env, static_cast<double>(${sanitizedName})));\n`;
          } else if (field.type === 'std::string') {
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
    // Генерируем .cpp файл
    const cppTemplate = fs.readFileSync(
      path.join(__dirname, 'templates', 'api.cpp.template'), 
      'utf-8'
    );

    // Генерируем .h файл
    const hppTemplate = fs.readFileSync(
      path.join(__dirname, 'templates', 'api.hpp.template'), 
      'utf-8'
    );

    let externDeclarations = '';
    let wrapperFunctions = '';
    let exportRegistrations = '';

    for (const exp of exports) {
      // Extern объявления
      externDeclarations += `extern ${exp.returnType} ${exp.name}(const ${exp.paramType}& param);\n`;
      
      if (exp.isAsync) {
        // Генерируем AsyncWorker для асинхронных функций
        wrapperFunctions += this.generateAsyncWrapper(exp);
      } else {
        // Обычные синхронные wrapper функции
        wrapperFunctions += this.generateSyncWrapper(exp);
      }
      
      // Регистрация экспортов
      exportRegistrations += `    exports.Set("${exp.name}", Napi::Function::New(env, ${exp.name}_wrapper));\n`;
    }

    // Генерируем .cpp файл
    let cppOutput = cppTemplate
      .replace('{{EXTERN_DECLARATIONS}}', externDeclarations)
      .replace('{{WRAPPER_FUNCTIONS}}', wrapperFunctions)
      .replace('{{EXPORT_REGISTRATIONS}}', exportRegistrations);

    fs.writeFileSync(path.join(outputDir, 'generated_api.cpp'), cppOutput);

    // Генерируем .h файл
    let hppOutput = hppTemplate
      .replace('{{EXTERN_DECLARATIONS}}', externDeclarations);

    fs.writeFileSync(path.join(outputDir, 'generated_api.h'), hppOutput);
  }

  /**
   * Генерирует синхронный wrapper для функции
   */
  private generateSyncWrapper(exp: ParsedExport): string {
    let wrapper = `\nNapi::Value ${exp.name}_wrapper(const Napi::CallbackInfo& info) {\n`;
    wrapper += `    Napi::Env env = info.Env();\n`;
    wrapper += `    \n`;
    wrapper += `    if (info.Length() < 1 || !info[0].IsObject()) {\n`;
    wrapper += `        Napi::TypeError::New(env, "Expected an object").ThrowAsJavaScriptException();\n`;
    wrapper += `        return env.Null();\n`;
    wrapper += `    }\n`;
    wrapper += `    \n`;
    wrapper += `    try {\n`;
    wrapper += `        ${exp.paramType} input = ${exp.paramType}::FromNapi(info[0].As<Napi::Object>());\n`;
    wrapper += `        ${exp.returnType} result = ${exp.name}(input);\n`;
    wrapper += `        return result.ToNapi(env);\n`;
    wrapper += `    } catch (const std::exception& e) {\n`;
    wrapper += `        Napi::Error::New(env, e.what()).ThrowAsJavaScriptException();\n`;
    wrapper += `        return env.Null();\n`;
    wrapper += `    }\n`;
    wrapper += `}\n`;
    return wrapper;
  }

  /**
   * Генерирует асинхронный wrapper для функции с Promise
   */
  private generateAsyncWrapper(exp: ParsedExport): string {
    let wrapper = '';
    
    // Генерируем AsyncWorker класс
    wrapper += `\n// AsyncWorker class for ${exp.name}\n`;
    wrapper += `class ${exp.name}_AsyncWorker : public Napi::AsyncWorker {\n`;
    wrapper += `public:\n`;
    wrapper += `    ${exp.name}_AsyncWorker(Napi::Function& callback, const ${exp.paramType}& input)\n`;
    wrapper += `        : Napi::AsyncWorker(callback), input_(input) {}\n`;
    wrapper += `    ~${exp.name}_AsyncWorker() {}\n\n`;
    
    wrapper += `    void Execute() override {\n`;
    wrapper += `        try {\n`;
    wrapper += `            result_ = ${exp.name}(input_);\n`;
    wrapper += `        } catch (const std::exception& e) {\n`;
    wrapper += `            SetError(e.what());\n`;
    wrapper += `        }\n`;
    wrapper += `    }\n\n`;
    
    wrapper += `    void OnOK() override {\n`;
    wrapper += `        Napi::HandleScope scope(Env());\n`;
    wrapper += `        Callback().Call({Env().Null(), result_.ToNapi(Env())});\n`;
    wrapper += `    }\n\n`;
    
    wrapper += `private:\n`;
    wrapper += `    ${exp.paramType} input_;\n`;
    wrapper += `    ${exp.returnType} result_;\n`;
    wrapper += `};\n\n`;
    
    // Генерируем wrapper функцию
    wrapper += `Napi::Value ${exp.name}_wrapper(const Napi::CallbackInfo& info) {\n`;
    wrapper += `    Napi::Env env = info.Env();\n`;
    wrapper += `    \n`;
    wrapper += `    if (info.Length() < 1 || !info[0].IsObject()) {\n`;
    wrapper += `        Napi::TypeError::New(env, "Expected an object").ThrowAsJavaScriptException();\n`;
    wrapper += `        return env.Null();\n`;
    wrapper += `    }\n`;
    wrapper += `    \n`;
    wrapper += `    ${exp.paramType} input = ${exp.paramType}::FromNapi(info[0].As<Napi::Object>());\n`;
    wrapper += `    \n`;
    wrapper += `    // Создаем Promise\n`;
    wrapper += `    auto deferred = Napi::Promise::Deferred::New(env);\n`;
    wrapper += `    \n`;
    wrapper += `    // Создаем callback функцию для Promise\n`;
    wrapper += `    auto callback = Napi::Function::New(env, [deferred](const Napi::CallbackInfo& info) {\n`;
    wrapper += `        Napi::Env env = info.Env();\n`;
    wrapper += `        if (info.Length() > 0 && !info[0].IsNull()) {\n`;
    wrapper += `            // Ошибка\n`;
    wrapper += `            deferred.Reject(info[0]);\n`;
    wrapper += `        } else if (info.Length() > 1) {\n`;
    wrapper += `            // Успех\n`;
    wrapper += `            deferred.Resolve(info[1]);\n`;
    wrapper += `        } else {\n`;
    wrapper += `            deferred.Reject(Napi::Error::New(env, "Invalid callback arguments").Value());\n`;
    wrapper += `        }\n`;
    wrapper += `        return env.Undefined();\n`;
    wrapper += `    });\n`;
    wrapper += `    \n`;
    wrapper += `    // Запускаем AsyncWorker\n`;
    wrapper += `    ${exp.name}_AsyncWorker* worker = new ${exp.name}_AsyncWorker(callback, input);\n`;
    wrapper += `    worker->Queue();\n`;
    wrapper += `    \n`;
    wrapper += `    return deferred.Promise();\n`;
    wrapper += `}\n`;
    
    return wrapper;
  }

  /**
   * Генерирует основной файл addon.cpp с инициализацией модуля
   */
  private generateMainAddon(exports: ParsedExport[], outputDir: string): void {
    const template = fs.readFileSync(
      path.join(__dirname, 'templates', 'addon.cpp.template'), 
      'utf-8'
    );

    // Записываем в cpp/src/addon.cpp (на уровень выше generated)
    const addonPath = path.join(path.dirname(outputDir), 'addon.cpp');
    
    // Создаем файл только если его еще нет (чтобы не затирать пользовательский код)
    if (!fs.existsSync(addonPath)) {
      fs.writeFileSync(addonPath, template);
    }
  }

  /**
   * Генерирует шаблон файла с реализациями пользователя
   */
  private generateImplementationTemplate(exports: ParsedExport[], outputDir: string): void {
    // Записываем в cpp/src/implementation.cpp (на уровень выше generated)
    const implPath = path.join(path.dirname(outputDir), 'implementation.cpp');
    
    // Проверяем, существует ли файл
    if (fs.existsSync(implPath)) {
      console.log(`⚠️  Implementation file already exists: ${implPath}`);
      console.log('   Skipping generation to preserve your code.');
      return;
    }

    const template = fs.readFileSync(
      path.join(__dirname, 'templates', 'implementation.cpp.template'), 
      'utf-8'
    );
    
    let externComments = '';
    let exampleImplementations = '';
    
    for (const exp of exports) {
      externComments += `// ${exp.returnType} ${exp.name}(const ${exp.paramType}& param);\n`;
      
      // Создаем пример реализации
      exampleImplementations += `\n${exp.returnType} ${exp.name}(const ${exp.paramType}& input) {\n`;
      exampleImplementations += `    ${exp.returnType} result;\n`;
      exampleImplementations += `    // TODO: Реализуйте логику здесь\n`;
      exampleImplementations += `    return result;\n`;
      exampleImplementations += `}\n`;
    }

    const output = template
      .replace('{{EXTERN_FUNCTION_COMMENTS}}', externComments)
      .replace('{{EXAMPLE_IMPLEMENTATIONS}}', exampleImplementations);

    fs.writeFileSync(implPath, output);
    console.log(`✅ Created implementation template: ${implPath}`);
  }

  /**
   * Генерирует TypeScript обертки для экспортов
   */
  private generateTypeScriptWrappers(parseResult: ParseResult, outputDir: string) {
    // Генерируем файл с типами
    this.generateTypesFile(parseResult, outputDir);
    
    // Генерируем файл с addon
    this.generateAddonFile(parseResult, outputDir);
  }

  /**
   * Генерирует файл с addon загрузчиком (generated_addon.ts)
   */
  private generateAddon(parseResult: ParseResult, outputDir: string) {
    this.generateAddonFile(parseResult, outputDir);
  }


  /**
   * Генерирует TypeScript типы (generated_types.ts)
   */
  public generateTypesFile(parseResult: ParseResult, outputDir: string) {
    // Собираем уникальные семантические типы для импорта
    const usedSemanticTypes = new Set<string>();
    
    for (const struct of parseResult.structs) {
      for (const field of struct.fields) {
        // Используем оригинальный TypeScript тип field.tsType
        if (['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64', 'f32', 'f64'].includes(field.tsType)) {
          usedSemanticTypes.add(field.tsType);
        }
      }
    }
    
    let content = '// Автоматически сгенерированные типы\n\n';
    
    // Определяем семантические типы локально, если они используются
    if (usedSemanticTypes.size > 0) {
      content += '// Базовые числовые типы\n';
      const sortedTypes = Array.from(usedSemanticTypes).sort();
      for (const type of sortedTypes) {
        content += `export type ${type} = number;\n`;
      }
      content += '\n';
    }

    // Генерируем интерфейсы с семантическими типами
    for (const struct of parseResult.structs) {
      content += `export interface ${struct.name} {\n`;
      for (const field of struct.fields) {
        const tsType = this.fieldToTSTypeBeautiful(field, parseResult.structs);
        content += `  ${field.name}: ${tsType};\n`;
      }
      content += '}\n\n';
    }

    fs.writeFileSync(path.join(outputDir, 'generated_types.ts'), content);
  }

  /**
   * Генерирует loader для addon (generated_addon.ts)
   */
  public generateAddonFile(parseResult: ParseResult, outputDir: string) {
    let content = '// Загрузчик нативного addon\n\n';
    
    // Собираем семантические типы для импорта
    const usedSemanticTypes = new Set<string>();
    
    for (const exp of parseResult.exports) {
      // Проверяем типы в параметрах и возвращаемом значении
      const semanticTypes = [exp.paramType, exp.returnType].filter(type => 
        ['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64', 'f32', 'f64'].includes(type)
      );
      semanticTypes.forEach(type => usedSemanticTypes.add(type));
    }
    
    // Определяем семантические типы локально, если они используются
    if (usedSemanticTypes.size > 0) {
      content += '// Базовые числовые типы\n';
      const sortedTypes = Array.from(usedSemanticTypes).sort();
      for (const type of sortedTypes) {
        content += `type ${type} = number;\n`;
      }
      content += '\n';
    }
    
    // Импорт сгенерированных типов
    const structNames = parseResult.structs.map(s => s.name);
    if (structNames.length > 0) {
      content += `import { ${structNames.join(', ')} } from './generated_types';\n`;
    }
    
    if (usedSemanticTypes.size > 0 || structNames.length > 0) {
      content += '\n';
    }

    // Декларация для require
    content += 'declare const require: any;\n\n';

    // Определяем интерфейс addon с правильными именами функций
    content += 'interface AddonExports {\n';
    for (const exp of parseResult.exports) {
      if (exp.isAsync) {
        content += `  ${exp.name}: (input: ${exp.paramType}) => Promise<${exp.returnType}>;\n`;
      } else {
        content += `  ${exp.name}: (input: ${exp.paramType}) => ${exp.returnType};\n`;
      }
    }
    content += '}\n\n';

    // Загрузка addon
    content += 'let addon: AddonExports;\n\n';
    content += 'try {\n';
    content += '  // Пробуем разные пути для поддержки ts-node и обычного node\n';
    content += '  let addonPath;\n';
    content += '  try {\n';
    content += '    addonPath = require.resolve(\'../../../build/Release/addon.node\');\n';
    content += '    addon = require(addonPath);\n';
    content += '  } catch (e1) {\n';
    content += '    try {\n';
    content += '      addonPath = require.resolve(\'../../build/Release/addon.node\');\n';
    content += '      addon = require(addonPath);\n';
    content += '    } catch (e2) {\n';
    content += '      try {\n';
    content += '        addonPath = require.resolve(\'../build/Release/addon.node\');\n';
    content += '        addon = require(addonPath);\n';
    content += '      } catch (e3) {\n';
    content += '        addonPath = require.resolve(\'./build/Release/addon.node\');\n';
    content += '        addon = require(addonPath);\n';
    content += '      }\n';
    content += '    }\n';
    content += '  }\n';
    content += '} catch (e) {\n';
    content += '  throw new Error(\'Native addon not found. Run npm run build first.\');\n';
    content += '}\n\n';
    content += 'export default addon;\n';

    fs.writeFileSync(path.join(outputDir, 'generated_addon.ts'), content);

    // Создаем также API файл с удобными классами
    this.generateAPIFile(parseResult, outputDir);
  }

  /**
   * Генерирует API файл с классами (generated_api.ts)
   */
  private generateAPIFile(parseResult: ParseResult, outputDir: string) {
    let content = '// Сгенерированный API с удобными классами\n\n';
    
    // Собираем семантические типы для импорта
    const usedSemanticTypes = new Set<string>();
    
    for (const exp of parseResult.exports) {
      // Проверяем типы в параметрах и возвращаемом значении
      const semanticTypes = [exp.paramType, exp.returnType].filter(type => 
        ['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64', 'f32', 'f64'].includes(type)
      );
      semanticTypes.forEach(type => usedSemanticTypes.add(type));
    }
    
    // Определяем семантические типы локально, если они используются
    if (usedSemanticTypes.size > 0) {
      content += '// Базовые числовые типы\n';
      const sortedTypes = Array.from(usedSemanticTypes).sort();
      for (const type of sortedTypes) {
        content += `type ${type} = number;\n`;
      }
      content += '\n';
    }
    
    // Импорт сгенерированных типов
    const structNames = parseResult.structs.map(s => s.name);
    if (structNames.length > 0) {
      content += `import { ${structNames.join(', ')} } from './generated_types';\n`;
    }
    content += `import addon from './generated_addon';\n\n`;

    // Группируем экспорты по классам
    const classMethods = new Map<string, ParsedExport[]>();
    
    for (const exp of parseResult.exports) {
      if (exp.className) {
        if (!classMethods.has(exp.className)) {
          classMethods.set(exp.className, []);
        }
        classMethods.get(exp.className)!.push(exp);
      }
    }

    // Генерируем классы с статическими методами
    for (const [className, methods] of classMethods) {
      content += `export class ${className} {\n`;
      for (const method of methods) {
        if (method.isAsync) {
          content += `  static async ${method.methodName}(input: ${method.paramType}): Promise<${method.returnType}> {\n`;
          content += `    return addon.${method.name}(input);\n`;
        } else {
          content += `  static ${method.methodName}(input: ${method.paramType}): ${method.returnType} {\n`;
          content += `    return addon.${method.name}(input);\n`;
        }
        content += `  }\n\n`;
      }
      content += '}\n\n';
    }

    fs.writeFileSync(path.join(outputDir, 'generated_api.ts'), content);
  }

  /**
   * Преобразует поле структуры в красивый TypeScript тип (для generated_types.ts)
   */
  private fieldToTSTypeBeautiful(field: ParsedField, structs: ParsedStruct[]): string {
    // Используем оригинальный TS тип напрямую
    let baseType = field.tsType;
    
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
    
    // Красивые числовые типы (семантические типы)
    const typeMap: { [key: string]: string } = {
      'int': 'number',
      'double': 'f64',
      'float': 'f32',
      'bool': 'boolean',
      'string': 'string',
      'std::string': 'string',
      'void': 'void',
      // Точные числовые типы (семантические)
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

  /**
   * Преобразует C++ тип в TypeScript тип (только для внутреннего использования)
   */
  private cppTypeToTS(cppType: string, structs: ParsedStruct[]): string {
    // Используем только семантические типы
    return this.cppTypeToTSBeautiful(cppType, structs);
  }
}
