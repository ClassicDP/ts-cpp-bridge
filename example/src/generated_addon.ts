// Загрузчик нативного addon

import { InputData, OutputData, LongTask, TaskResult } from './generated_types';

declare const require: any;

interface AddonExports {
  Solver_process: (input: InputData) => OutputData;
  Solver_processLongTask: (input: LongTask) => Promise<TaskResult>;
  Solver_processHeavyComputation: (input: InputData) => Promise<OutputData>;
}

let addon: AddonExports;

try {
  // Пробуем разные пути для поддержки ts-node и обычного node
  let addonPath;
  try {
    addonPath = require.resolve('../../build/Release/addon.node');
    addon = require(addonPath);
  } catch (e1) {
    try {
      addonPath = require.resolve('../build/Release/addon.node');
      addon = require(addonPath);
    } catch (e2) {
      addonPath = require.resolve('./build/Release/addon.node');
      addon = require(addonPath);
    }
  }
} catch (e) {
  throw new Error('Native addon not found. Run npm run build first.');
}

export default addon;
