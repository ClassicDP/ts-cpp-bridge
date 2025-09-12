# ts-cpp-bridge

[![npm version](https://badge.fury.io/js/ts-cpp-bridge.svg)](https://badge.fury.io/js/ts-cpp-bridge)
[![Node.js CI](https://github.com/ClassicDP/ts-cpp-bridge/workflows/Node.js%20CI/badge.svg)](https://github.com/ClassicDP/ts-cpp-bridge/actions)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7+-blue.svg)](https://www.typescriptlang.org/)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)](https://nodejs.org/)

**Генератор C++ кода из TypeScript декораторов для Node.js N-API addon**

ts-cpp-bridge автоматически генерирует C++ glue код и типобезопасные TypeScript обертки, позволяя легко интегрировать C++ вычисления в TypeScript проекты.

## 🚀 Основные возможности

- **Автогенерация C++ кода** из TypeScript интерфейсов и декораторов
- **Типобезопасные TypeScript обертки** для C++ функций
- **Скрытие деталей addon** - чистый TypeScript API для пользователей
- **Поддержка массивов** и пользовательских структур
- **Обработка зарезервированных C++ ключевых слов**
- **Поддержка статических методов** и свободных функций

## 📦 Установка

```bash
npm install ts-cpp-bridge
```

### Системные требования

- Node.js 18+
- TypeScript 5.0+
- C++ компилятор (GCC, Clang или MSVC)
- Python 3.x (для node-gyp)

### Установка пиринговых зависимостей

```bash
npm install node-addon-api
```

## ⚙️ Требования и настройка

### TypeScript конфигурация

Для корректной работы декораторов добавьте в `tsconfig.json`:

```json
{
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "target": "ES2020",
    "module": "commonjs",
    "esModuleInterop": true
  }
}
```

### Установка

```bash
npm install ts-cpp-bridge reflect-metadata
```

## 🎯 Быстрый старт

### 1. Определите типы данных и API

```typescript
// types.ts
import { CppStruct, CppExport } from 'ts-cpp-bridge';

@CppStruct()
export class InputData {
  name!: string;
  value!: number;
  numbers!: number[];
}

@CppStruct()
export class OutputData {
  greeting!: string;
  doubled!: number;
  squared!: number[];
}

export class Solver {
  @CppExport()
  static process(input: InputData): OutputData {
    throw new Error('Implemented in C++');
  }
}
```

### 2. Сгенерируйте код

```bash
npx ts-cpp-bridge generate -i types.ts -o src/
```

Будет создано:

- `generated_structs.hpp/cpp` - C++ структуры данных
- `generated_api.cpp` - N-API обертки
- `generated_addon.d.ts` - типы для addon
- `generated_api.ts` - __типобезопасные TypeScript обертки__

### 3. Используйте типобезопасный API

```typescript
// main.ts
import { Solver, InputData, OutputData } from './src/generated_api';

const input: InputData = {
  name: 'Alice',
  value: 7,
  numbers: [1, 2, 3, 4, 5]
};

// ✅ Типобезопасный вызов - никаких addon.something()!
const result: OutputData = Solver.process(input);
console.log(result);
```

## 🎯 Преимущества

- **Безопасность типов** - ошибки обнаруживаются на этапе компиляции
- **Чистый API** - пользователи работают с TypeScript классами/функциями
- **Автоматизация** - нет ручного написания glue кода
- **Поддержка IDE** - полная поддержка автокомплита и IntelliSense
- **Простота использования** - от декораторов до готового API за одну команду

## 🤝 Авторы

- **dp** - основной разработчик
- **smoki** - соавтор

## 📄 Лицензия

MIT License - см. [LICENSE](LICENSE) файл для деталей.

---

**ts-cpp-bridge** - ваш мост между TypeScript и C++ с типобезопасностью! 🌉
