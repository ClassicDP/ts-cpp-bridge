#pragma once

#include <napi.h>
#include <string>
#include <vector>


struct InputData {
    std::string name;
    int value;
    std::vector<int> numbers;
    static InputData FromNapi(const Napi::Object& obj);
    Napi::Object ToNapi(Napi::Env env) const;
};

struct OutputData {
    std::string greeting;
    int doubled;
    std::vector<int> squared;
    static OutputData FromNapi(const Napi::Object& obj);
    Napi::Object ToNapi(Napi::Env env) const;
};

