// Автоматически сгенерированные типы для addon

export interface InputData {
  name: string;
  value: number;
  numbers: number[];
}

export interface OutputData {
  greeting: string;
  doubled: number;
  squared: number[];
}

export interface AddonExports {
  Solver_process: (input: InputData) => OutputData;
}

declare const addon: AddonExports;
export default addon;
