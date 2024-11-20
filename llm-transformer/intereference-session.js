class InferenceSession {
  constructor(handler) {
    this.handler = handler;
  }
  async run(feeds, arg1, arg2) {
    const fetches = {};
    let options = {};

    if (
      typeof feeds !== "object" ||
      feeds === null ||
      feeds instanceof _tensor__WEBPACK_IMPORTED_MODULE_EXTRA__.Tensor ||
      Array.isArray(feeds)
    ) {
      throw new TypeError(
        "'feeds' must be an object that use input names as keys and OnnxValue as corresponding values."
      );
    }
    let isFetchesEmpty = false;

    if (typeof arg1 === "object") {
      if (arg1 === null) {
        throw new TypeError("Unexpected argument[1]: cannot be null.");
      }
      if (arg1 instanceof _tensor__WEBPACK_IMPORTED_MODULE_1__.Tensor) {
        throw new TypeError("'fetches' cannot be a Tensor");
      }
      if (Array.isArray(arg1)) {
        if (arg1.length === 0) {
          throw new TypeError("'fetches' cannot be an empty array.");
        }
        isFetchesEmpty = false;

        for (const name of arg1) {
          if (typeof name !== "string") {
            throw new TypeError(
              "'fetches' must be a string array or an object."
            );
          }

          fetches[name] = null;
        }
        if (typeof arg2 === "object" && arg2 !== null) {
          options = arg2;
        } else if (typeof arg2 !== "undefined") {
          throw new TypeError("'options' must be an object.");
        }
      }
    }

    for (const name of this.inputNames) {
      if (typeof feeds[name] === "undefined") {
        throw new Error(`input '${name}' is missing in 'feeds'.`);
      }
    }

    if (isFetchesEmpty) {
      for (const name of this.outputNames) {
        fetches[name] = null;
      }
    }

    const results = await this.handler.run(feeds, fetches, options);
    const returnValue = {};
    for (const key in results) {
      if (Object.hasOwnProperty.call(results, key)) {
        returnValue[key] = new _tensor__WEBPACK_IMPORTED_MODULE_1__.Tensor(
          results[key].type,
          results[key].data,
          results[key].dims
        );
      }
    }
    return returnValue;
  }
}
