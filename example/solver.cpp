#include "generated_structs.hpp"

// Реализация функции process - вызывается из N-API wrapper
OutputData process(const InputData& input) {
    OutputData output;
    
    // Обработка строки
    output.greeting = "Hello, " + input.name + "!";
    
    // Обработка числа
    output.doubled = input.value * 2;
    
    // Обработка массива - возводим в квадрат
    output.squared.reserve(input.numbers.size());
    for (int num : input.numbers) {
        output.squared.push_back(num * num);
    }
    
    return output;
}
