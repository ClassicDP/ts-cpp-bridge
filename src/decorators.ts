import 'reflect-metadata';

// Расширяем типы Reflect для metadata API
declare global {
  namespace Reflect {
    function getMetadata(metadataKey: any, target: any, propertyKey?: string | symbol): any;
    function defineMetadata(metadataKey: any, metadataValue: any, target: any, propertyKey?: string | symbol): void;
  }
}

// Ключи для metadata
const STRUCT_METADATA_KEY = Symbol('CppStruct');
const EXPORT_METADATA_KEY = Symbol('CppExport');
const FIELD_METADATA_KEY = Symbol('CppField');

/**
 * Интерфейс для описания поля структуры
 */
export interface FieldInfo {
  name: string;
  type: string;
  isArray: boolean;
}

/**
 * Интерфейс для описания структуры
 */
export interface StructInfo {
  name: string;
  fields: FieldInfo[];
}

/**
 * Интерфейс для описания экспортируемого метода
 */
export interface ExportInfo {
  name: string;
  paramType: string;
  returnType: string;
}

/**
 * Декоратор для пометки класса как C++ структуры
 */
export function CppStruct(): <T extends { new (...args: any[]): {} }>(constructor: T) => T {
  return function <T extends { new (...args: any[]): {} }>(constructor: T): T {
    // Получаем информацию о полях из reflect-metadata
    const fields: FieldInfo[] = [];
    const prototype = constructor.prototype;
    
    // Получаем имена всех свойств класса
    const propertyNames = Object.getOwnPropertyNames(prototype);
    
    for (const propertyName of propertyNames) {
      if (propertyName === 'constructor') continue;
      
      // Получаем тип из metadata (если доступен)
      const type = Reflect.getMetadata('design:type', prototype, propertyName);
      
      if (type) {
        fields.push({
          name: propertyName,
          type: getTypeString(type),
          isArray: Array.isArray(type) || type === Array
        });
      }
    }
    
    const structInfo: StructInfo = {
      name: constructor.name,
      fields
    };
    
    Reflect.defineMetadata(STRUCT_METADATA_KEY, structInfo, constructor);
    return constructor;
  };
}

/**
 * Декоратор для пометки метода как экспортируемого в C++
 * Может использоваться как @CppExport() или @CppExport
 * Поддерживает как legacy, так и современные декораторы TypeScript
 */
export function CppExport(): any;
export function CppExport(target: any, propertyKey: string | symbol, descriptor?: any): any;
export function CppExport(...args: any[]): any {
  if (args.length === 0) {
    // Вызов с скобками: @CppExport()
    return function (target: any, propertyKey: string | symbol, descriptorOrContext?: any): any {
      return applyExportDecorator(target, propertyKey, descriptorOrContext);
    };
  } else {
    // Прямой вызов: @CppExport
    return applyExportDecorator(args[0], args[1], args[2]);
  }
}

/**
 * Применяет логику декоратора экспорта
 */
function applyExportDecorator(target: any, propertyKey: string | symbol, descriptorOrContext?: any): any {
  // Поддержка как legacy, так и современного API декораторов
  let actualTarget = target;
  let actualPropertyKey = propertyKey;
  
  // Если это новый API декораторов (TypeScript 5.0+)
  if (descriptorOrContext && typeof descriptorOrContext === 'object' && 'kind' in descriptorOrContext) {
    // Новый decorator context API
    actualTarget = descriptorOrContext.metadata ? descriptorOrContext : target;
    actualPropertyKey = descriptorOrContext.name || propertyKey;
  }
  
  // Получаем типы параметров и возвращаемого значения
  const paramTypes = Reflect.getMetadata('design:paramtypes', actualTarget, actualPropertyKey) || [];
  const returnType = Reflect.getMetadata('design:returntype', actualTarget, actualPropertyKey);
  
  const exportInfo: ExportInfo = {
    name: actualPropertyKey.toString(),
    paramType: paramTypes.length > 0 ? getTypeString(paramTypes[0]) : 'void',
    returnType: returnType ? getTypeString(returnType) : 'void'
  };
  
  Reflect.defineMetadata(EXPORT_METADATA_KEY, exportInfo, actualTarget, actualPropertyKey);
  
  // Возвращаем descriptor если он есть (legacy API), или undefined
  return descriptorOrContext && typeof descriptorOrContext === 'object' && 'value' in descriptorOrContext 
    ? descriptorOrContext 
    : undefined;
}

/**
 * Вспомогательная функция для получения строкового представления типа
 */
function getTypeString(type: any): string {
  if (type === String) return 'string';
  if (type === Number) return 'number';
  if (type === Boolean) return 'boolean';
  if (type === Array) return 'array';
  if (typeof type === 'function') return type.name;
  return 'unknown';
}

/**
 * Получить информацию о структуре из класса
 */
export function getStructInfo(constructor: any): StructInfo | undefined {
  return Reflect.getMetadata(STRUCT_METADATA_KEY, constructor);
}

/**
 * Получить информацию об экспорте из метода
 */
export function getExportInfo(target: any, propertyKey: string): ExportInfo | undefined {
  return Reflect.getMetadata(EXPORT_METADATA_KEY, target, propertyKey);
}

/**
 * Получить все экспорты из класса
 */
export function getAllExports(constructor: any): ExportInfo[] {
  const exports: ExportInfo[] = [];
  const prototype = constructor.prototype;
  
  const propertyNames = Object.getOwnPropertyNames(prototype);
  
  for (const propertyName of propertyNames) {
    if (propertyName === 'constructor') continue;
    
    const exportInfo = getExportInfo(prototype, propertyName);
    if (exportInfo) {
      exports.push(exportInfo);
    }
  }
  
  return exports;
}
