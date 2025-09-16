/**
 * Уточняемые числовые типы для генерации C++ кода
 */

// Базовые числовые типы
export type i8 = number;   // int8_t
export type u8 = number;   // uint8_t
export type i16 = number;  // int16_t
export type u16 = number;  // uint16_t
export type i32 = number;  // int32_t
export type u32 = number;  // uint32_t
export type i64 = number;  // int64_t
export type u64 = number;  // uint64_t
export type f32 = number;  // float
export type f64 = number;  // double

// Маппинг TypeScript типов на C++ типы
export const TypeMapping = {
  // Основные типы
  'string': 'std::string',
  'number': 'double',
  'boolean': 'bool',
  
  // Уточняемые числовые типы
  'i8': 'int8_t',
  'u8': 'uint8_t',
  'i16': 'int16_t',
  'u16': 'uint16_t',
  'i32': 'int32_t',
  'u32': 'uint32_t',
  'i64': 'int64_t',
  'u64': 'uint64_t',
  'f32': 'float',
  'f64': 'double'
} as const;

// Маппинг для Node.js N-API типов
export const NapiTypeMapping = {
  'string': 'String',
  'number': 'Number',
  'boolean': 'Boolean',
  'i8': 'Number',
  'u8': 'Number',
  'i16': 'Number',
  'u16': 'Number',
  'i32': 'Number',
  'u32': 'Number',
  'i64': 'BigInt',  // для больших чисел используем BigInt
  'u64': 'BigInt',
  'f32': 'Number',
  'f64': 'Number'
} as const;

// Функции для извлечения значений из N-API
export const NapiExtractorMapping = {
  'string': '.As<Napi::String>().Utf8Value()',
  'number': '.As<Napi::Number>().DoubleValue()',
  'boolean': '.As<Napi::Boolean>().Value()',
  'i8': '.As<Napi::Number>().Int32Value()',
  'u8': '.As<Napi::Number>().Uint32Value()',
  'i16': '.As<Napi::Number>().Int32Value()',
  'u16': '.As<Napi::Number>().Uint32Value()',
  'i32': '.As<Napi::Number>().Int32Value()',
  'u32': '.As<Napi::Number>().Uint32Value()',
  'i64': '.As<Napi::BigInt>().Int64Value()',
  'u64': '.As<Napi::BigInt>().Uint64Value()',
  'f32': '.As<Napi::Number>().FloatValue()',
  'f64': '.As<Napi::Number>().DoubleValue()'
} as const;

/**
 * Получить C++ тип по TypeScript типу
 */
export function getCppType(tsType: string): string {
  // Обработка Set типов
  if (tsType.startsWith('Set<') && tsType.endsWith('>')) {
    const innerType = tsType.slice(4, -1); // Извлекаем внутренний тип
    const cppInnerType = getCppType(innerType); // Рекурсивно обрабатываем внутренний тип
    return `std::unordered_set<${cppInnerType}>`;
  }
  
  // Обработка Map типов
  if (tsType.startsWith('Map<') && tsType.endsWith('>')) {
    const innerTypes = tsType.slice(4, -1); // Извлекаем внутренние типы
    const [keyType, valueType] = innerTypes.split(',').map(t => t.trim());
    const cppKeyType = getCppType(keyType);
    const cppValueType = getCppType(valueType);
    return `std::unordered_map<${cppKeyType}, ${cppValueType}>`;
  }
  
  // Обработка Array типов
  if (tsType.startsWith('Array<') && tsType.endsWith('>')) {
    const innerType = tsType.slice(6, -1); // Извлекаем внутренний тип
    const cppInnerType = getCppType(innerType);
    return `std::vector<${cppInnerType}>`;
  }
  
  // Обработка массивов типа Type[]
  if (tsType.endsWith('[]')) {
    const innerType = tsType.slice(0, -2); // Убираем []
    const cppInnerType = getCppType(innerType);
    return `std::vector<${cppInnerType}>`;
  }
  
  return TypeMapping[tsType as keyof typeof TypeMapping] || tsType;
}

/**
 * Получить N-API тип по TypeScript типу
 */
export function getNapiType(tsType: string): string {
  return NapiTypeMapping[tsType as keyof typeof NapiTypeMapping] || 'Value';
}

/**
 * Получить экстрактор N-API по TypeScript типу
 */
export function getNapiExtractor(tsType: string): string {
  return NapiExtractorMapping[tsType as keyof typeof NapiExtractorMapping] || '.As<Napi::Value>()';
}

/**
 * Проверить, является ли тип уточняемым числовым
 */
export function isPreciseNumericType(tsType: string): boolean {
  return ['i8', 'u8', 'i16', 'u16', 'i32', 'u32', 'i64', 'u64', 'f32', 'f64'].includes(tsType);
}
