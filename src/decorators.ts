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
const ASYNC_EXPORT_METADATA_KEY = Symbol('CppAsync');
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
  isAsync?: boolean;  // Новое поле для асинхронных методов
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
 * Поддерживает современные декораторы TypeScript
 */
export function CppExport<T = any>(): MethodDecorator {
  return function <T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
    applyExportDecorator(target, propertyKey, descriptor, false);
    return descriptor;
  };
}

/**
 * Декоратор для пометки метода как асинхронного экспортируемого в C++
 * Функция будет возвращать Promise и выполняться в отдельном потоке
 */
export function CppAsync<T = any>(): MethodDecorator {
  return function <T>(target: Object, propertyKey: string | symbol, descriptor: TypedPropertyDescriptor<T>): TypedPropertyDescriptor<T> | void {
    applyExportDecorator(target, propertyKey, descriptor, true);
    return descriptor;
  };
}

/**
 * Применяет логику декоратора экспорта
 */
function applyExportDecorator(target: any, propertyKey: string | symbol, descriptor: any, isAsync: boolean = false): void {
  // Получаем типы параметров и возвращаемого значения
  const paramTypes = Reflect.getMetadata('design:paramtypes', target, propertyKey) || [];
  const returnType = Reflect.getMetadata('design:returntype', target, propertyKey);
  
  const exportInfo: ExportInfo = {
    name: propertyKey.toString(),
    paramType: paramTypes.length > 0 ? getTypeString(paramTypes[0]) : 'void',
    returnType: returnType ? getTypeString(returnType) : 'void',
    isAsync
  };
  
  // Для асинхронных функций используем отдельный ключ metadata
  const metadataKey = isAsync ? ASYNC_EXPORT_METADATA_KEY : EXPORT_METADATA_KEY;
  Reflect.defineMetadata(metadataKey, exportInfo, target, propertyKey);
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
 * Получить информацию об асинхронном экспорте из метода
 */
export function getAsyncExportInfo(target: any, propertyKey: string): ExportInfo | undefined {
  return Reflect.getMetadata(ASYNC_EXPORT_METADATA_KEY, target, propertyKey);
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
    
    // Проверяем как синхронные, так и асинхронные экспорты
    const exportInfo = getExportInfo(prototype, propertyName);
    if (exportInfo) {
      exports.push(exportInfo);
    }
    
    const asyncExportInfo = getAsyncExportInfo(prototype, propertyName);
    if (asyncExportInfo) {
      exports.push(asyncExportInfo);
    }
  }
  
  return exports;
}
