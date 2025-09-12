#include "generated_structs.hpp"


InputData InputData::FromNapi(const Napi::Object& obj) {
    InputData result;
    if (obj.Has("name")) {
        result.name = obj.Get("name").As<Napi::String>().Utf8Value();
    }
    if (obj.Has("value")) {
        result.value = obj.Get("value").As<Napi::Number>().Int32Value();
    }
    if (obj.Has("numbers") && obj.Get("numbers").IsArray()) {
        Napi::Array arr = obj.Get("numbers").As<Napi::Array>();
        for (uint32_t i = 0; i < arr.Length(); i++) {
            result.numbers.push_back(arr.Get(i).As<Napi::Number>().Int32Value());
        }
    }
    return result;
}

Napi::Object InputData::ToNapi(Napi::Env env) const {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("name", Napi::String::New(env, name));
    obj.Set("value", Napi::Number::New(env, value));
    Napi::Array arr = Napi::Array::New(env, numbers.size());
    for (size_t i = 0; i < numbers.size(); i++) {
        arr.Set(i, Napi::Number::New(env, numbers[i]));
    }
    obj.Set("numbers", arr);
    return obj;
}

OutputData OutputData::FromNapi(const Napi::Object& obj) {
    OutputData result;
    if (obj.Has("greeting")) {
        result.greeting = obj.Get("greeting").As<Napi::String>().Utf8Value();
    }
    if (obj.Has("doubled")) {
        result.doubled = obj.Get("doubled").As<Napi::Number>().Int32Value();
    }
    if (obj.Has("squared") && obj.Get("squared").IsArray()) {
        Napi::Array arr = obj.Get("squared").As<Napi::Array>();
        for (uint32_t i = 0; i < arr.Length(); i++) {
            result.squared.push_back(arr.Get(i).As<Napi::Number>().Int32Value());
        }
    }
    return result;
}

Napi::Object OutputData::ToNapi(Napi::Env env) const {
    Napi::Object obj = Napi::Object::New(env);
    obj.Set("greeting", Napi::String::New(env, greeting));
    obj.Set("doubled", Napi::Number::New(env, doubled));
    Napi::Array arr = Napi::Array::New(env, squared.size());
    for (size_t i = 0; i < squared.size(); i++) {
        arr.Set(i, Napi::Number::New(env, squared[i]));
    }
    obj.Set("squared", arr);
    return obj;
}

