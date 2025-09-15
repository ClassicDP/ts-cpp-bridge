#include "generated_structs.hpp"


InputData InputData::FromNapi(const Napi::Object& obj) {
    InputData result;
    
    try {
        if (obj.Has("name")) {
            result.name = obj.Get("name").As<Napi::String>().Utf8Value();
        }
        if (obj.Has("value")) {
            result.value = obj.Get("value").As<Napi::Number>().DoubleValue();
        }
        if (obj.Has("numbers") && obj.Get("numbers").IsArray()) {
            Napi::Array arr = obj.Get("numbers").As<Napi::Array>();
            for (uint32_t i = 0; i < arr.Length(); i++) {
                result.numbers.push_back(arr.Get(i).As<Napi::Number>().DoubleValue());
            }
        }
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to parse InputData: ") + e.what());
    }
    
    return result;
}

Napi::Object InputData::ToNapi(Napi::Env env) const {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("name", Napi::String::New(env, name));
    Napi::Array numbersArr = Napi::Array::New(env, numbers.size());
    for (size_t i = 0; i < numbers.size(); i++) {
        numbersArr.Set(i, Napi::Number::New(env, numbers[i]));
    }
    obj.Set("numbers", numbersArr);
    return obj;
}

OutputData OutputData::FromNapi(const Napi::Object& obj) {
    OutputData result;
    
    try {
        if (obj.Has("greeting")) {
            result.greeting = obj.Get("greeting").As<Napi::String>().Utf8Value();
        }
        if (obj.Has("doubled")) {
            result.doubled = obj.Get("doubled").As<Napi::Number>().DoubleValue();
        }
        if (obj.Has("squared") && obj.Get("squared").IsArray()) {
            Napi::Array arr = obj.Get("squared").As<Napi::Array>();
            for (uint32_t i = 0; i < arr.Length(); i++) {
                result.squared.push_back(arr.Get(i).As<Napi::Number>().DoubleValue());
            }
        }
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to parse OutputData: ") + e.what());
    }
    
    return result;
}

Napi::Object OutputData::ToNapi(Napi::Env env) const {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("greeting", Napi::String::New(env, greeting));
    Napi::Array squaredArr = Napi::Array::New(env, squared.size());
    for (size_t i = 0; i < squared.size(); i++) {
        squaredArr.Set(i, Napi::Number::New(env, squared[i]));
    }
    obj.Set("squared", squaredArr);
    return obj;
}

LongTask LongTask::FromNapi(const Napi::Object& obj) {
    LongTask result;
    
    try {
        if (obj.Has("duration")) {
            result.duration = obj.Get("duration").As<Napi::Number>().DoubleValue();
        }
        if (obj.Has("data")) {
            result.data = obj.Get("data").As<Napi::String>().Utf8Value();
        }
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to parse LongTask: ") + e.what());
    }
    
    return result;
}

Napi::Object LongTask::ToNapi(Napi::Env env) const {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("data", Napi::String::New(env, data));
    return obj;
}

TaskResult TaskResult::FromNapi(const Napi::Object& obj) {
    TaskResult result;
    
    try {
        if (obj.Has("message")) {
            result.message = obj.Get("message").As<Napi::String>().Utf8Value();
        }
        if (obj.Has("duration")) {
            result.duration = obj.Get("duration").As<Napi::Number>().DoubleValue();
        }
        if (obj.Has("timestamp")) {
            result.timestamp = obj.Get("timestamp").As<Napi::Number>().DoubleValue();
        }
    } catch (const std::exception& e) {
        throw std::runtime_error(std::string("Failed to parse TaskResult: ") + e.what());
    }
    
    return result;
}

Napi::Object TaskResult::ToNapi(Napi::Env env) const {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("message", Napi::String::New(env, message));
    return obj;
}

