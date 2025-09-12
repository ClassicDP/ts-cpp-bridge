#pragma once

#include <napi.h>
#include <string>
#include <vector>


struct InputData {
    std::string name;
    double value;
    std::vector<double> numbers;
    static InputData FromNapi(const Napi::Object& obj);
    Napi::Object ToNapi(Napi::Env env) const;
};

struct OutputData {
    std::string greeting;
    double doubled;
    std::vector<double> squared;
    static OutputData FromNapi(const Napi::Object& obj);
    Napi::Object ToNapi(Napi::Env env) const;
};

