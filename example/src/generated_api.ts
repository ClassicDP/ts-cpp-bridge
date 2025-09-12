// Автоматически сгенерированные TypeScript обертки

// Декларация для require
declare const require: any;

import { f64 } from 'ts-cpp-bridge';

export interface InputData {
  name: string;
  value: f64;
  numbers: f64[];
}

export interface OutputData {
  greeting: string;
  doubled: f64;
  squared: f64[];
}

// Низкоуровневые типы для C++ addon
interface InputDataNative {
  name: string;
  value: number;
  numbers: number[];
}

interface OutputDataNative {
  greeting: string;
  doubled: number;
  squared: number[];
}

interface AddonExports {
  Solver_process: (input: InputDataNative) => OutputDataNative;
}

// Импорт нативного addon
const addon: AddonExports = (() => {
  try {
    return require('../../build/Release/addon');
  } catch (e) {
    throw new Error('Native addon not found. Run npm run build:native first.');
  }
})();

// Функции преобразования типов
function toInputDataNative(input: InputData): InputDataNative {
  return input as any; // Типы совместимы на runtime
}

function fromInputDataNative(input: InputDataNative): InputData {
  return input as any; // Типы совместимы на runtime
}

function toOutputDataNative(input: OutputData): OutputDataNative {
  return input as any; // Типы совместимы на runtime
}

function fromOutputDataNative(input: OutputDataNative): OutputData {
  return input as any; // Типы совместимы на runtime
}


export class Solver {
  static process(input: InputData): OutputData {
    const nativeInput = toInputDataNative(input);
    const result = addon.Solver_process(nativeInput);
    return fromOutputDataNative(result);
  }

}

