class Tensor {
  constructor(arg0, arg1, arg2) {
    let type;
    let data;
    let dims;

    if (typeof arg0 === "string") {
      type = arg0;
      dims = arg2;
      if (arg0 === "string") {
        if (!Array.isArray(arg1)) {
          throw new TypeError("A string tensor's data must be a string array.");
        }

        data = arg1;
      } else {
        const typedArrayConstructor =
          NUMERIC_TENSOR_TYPE_TO_TYPEDARRAY_MAP.get(arg0);
        if (typedArrayConstructor === undefined) {
          throw new TypeError(`Unsupported tensor type: ${arg0}.`);
        }
        if (Array.isArray(arg1)) {
          data = typedArrayConstructor.from(arg1);
        } else if (arg1 instanceof typedArrayConstructor) {
          data = arg1;
        } else {
          throw new TypeError(
            `A ${type} tensor's data must be type of ${typedArrayConstructor}`
          );
        }
      }
    } else {
      dims = arg1;
      if (Array.isArray(arg0)) {
        if (arg0.length === 0) {
          throw new TypeError(
            "Tensor type cannot be inferred from an empty array."
          );
        }
        const firstElementType = typeof arg0[0];
        if (firstElementType === "string") {
          type = "string";
          data = arg0;
        } else if (firstElementType === "boolean") {
          type = "bool";

          data = Uint8Array.from(arg0);
        } else {
          throw new TypeError(
            `Invalid element type of data array: ${firstElementType}.`
          );
        }
      } else {
        const mappedType = NUMERIC_TENSOR_TYPEDARRAY_TO_TYPE_MAP.get(
          arg0.constructor
        );
        if (mappedType === undefined) {
          throw new TypeError(
            `Unsupported type for tensor data: ${arg0.constructor}.`
          );
        }
        type = mappedType;
        data = arg0;
      }
    }

    if (dims === undefined) {
      dims = [data.length];
    } else if (!Array.isArray(dims)) {
      throw new TypeError("A tensor's dims must be a number array");
    }

    const size = calculateSize(dims);
    if (size !== data.length) {
      throw new Error(
        `Tensor's size(${size}) does not match data length(${data.length}).`
      );
    }
    this.dims = dims;
    this.type = type;
    this.data = data;
    this.size = size;
  }

  /**
   * Create a new tensor object from image object
   *
   * @param buffer - Extracted image buffer data - assuming RGBA format
   * @param imageFormat - input image configuration - required configurations height, width, format
   * @param tensorFormat - output tensor configuration - Default is RGB format
   */
  static bufferToTensor(buffer, options) {
    if (buffer === undefined) {
      throw new Error("Image buffer must be defined");
    }
    if (options.height === undefined || options.width === undefined) {
      throw new Error("Image height and width must be defined");
    }
    const { height, width } = options;
    const norm = options.norm;
    let normMean;
    let normBias;
    if (norm === undefined || norm.mean === undefined) {
      normMean = 255;
    } else {
      normMean = norm.mean;
    }
    if (norm === undefined || norm.bias === undefined) {
      normBias = 0;
    } else {
      normBias = norm.bias;
    }
    const inputformat =
      options.bitmapFormat !== undefined ? options.bitmapFormat : "RGBA";

    const outputformat =
      options.tensorFormat !== undefined
        ? options.tensorFormat !== undefined
          ? options.tensorFormat
          : "RGB"
        : "RGB";
    const offset = height * width;
    const float32Data =
      outputformat === "RGBA"
        ? new Float32Array(offset * 4)
        : new Float32Array(offset * 3);

    let step = 4,
      rImagePointer = 0,
      gImagePointer = 1,
      bImagePointer = 2,
      aImagePointer = 3;
    let rTensorPointer = 0,
      gTensorPointer = offset,
      bTensorPointer = offset * 2,
      aTensorPointer = -1;

    if (inputformat === "RGB") {
      step = 3;
      rImagePointer = 0;
      gImagePointer = 1;
      bImagePointer = 2;
      aImagePointer = -1;
    }

    if (outputformat === "RGBA") {
      aTensorPointer = offset * 3;
    } else if (outputformat === "RBG") {
      rTensorPointer = 0;
      bTensorPointer = offset;
      gTensorPointer = offset * 2;
    } else if (outputformat === "BGR") {
      bTensorPointer = 0;
      gTensorPointer = offset;
      rTensorPointer = offset * 2;
    }
    for (
      let i = 0;
      i < offset;
      i++,
        rImagePointer += step,
        bImagePointer += step,
        gImagePointer += step,
        aImagePointer += step
    ) {
      float32Data[rTensorPointer++] =
        (buffer[rImagePointer] + normBias) / normMean;
      float32Data[gTensorPointer++] =
        (buffer[gImagePointer] + normBias) / normMean;
      float32Data[bTensorPointer++] =
        (buffer[bImagePointer] + normBias) / normMean;
      if (aTensorPointer !== -1 && aImagePointer !== -1) {
        float32Data[aTensorPointer++] =
          (buffer[aImagePointer] + normBias) / normMean;
      }
    }

    const outputTensor =
      outputformat === "RGBA"
        ? new Tensor("float32", float32Data, [1, 4, height, width])
        : new Tensor("float32", float32Data, [1, 3, height, width]);
    return outputTensor;
  }
  static async fromImage(image, options) {
    const isHTMLImageEle =
      typeof HTMLImageElement !== "undefined" &&
      image instanceof HTMLImageElement;
    const isImageDataEle =
      typeof ImageData !== "undefined" && image instanceof ImageData;
    const isImageBitmap =
      typeof ImageBitmap !== "undefined" && image instanceof ImageBitmap;
    const isURL =
      typeof String !== "undefined" &&
      (image instanceof String || typeof image === "string");
    let data;
    let tensorConfig = {};

    if (isHTMLImageEle) {
      const canvas = document.createElement("canvas");
      const pixels2DContext = canvas.getContext("2d");
      if (pixels2DContext != null) {
        let height = image.naturalHeight;
        let width = image.naturalWidth;
        if (
          options !== undefined &&
          options.resizedHeight !== undefined &&
          options.resizedWidth !== undefined
        ) {
          height = options.resizedHeight;
          width = options.resizedWidth;
        }
        if (options !== undefined) {
          tensorConfig = options;
          if (options.tensorFormat !== undefined) {
            throw new Error(
              "Image input config format must be RGBA for HTMLImageElement"
            );
          } else {
            tensorConfig.tensorFormat = "RGBA";
          }
          if (options.height !== undefined && options.height !== height) {
            throw new Error(
              "Image input config height doesn't match HTMLImageElement height"
            );
          } else {
            tensorConfig.height = height;
          }
          if (options.width !== undefined && options.width !== width) {
            throw new Error(
              "Image input config width doesn't match HTMLImageElement width"
            );
          } else {
            tensorConfig.width = width;
          }
        } else {
          tensorConfig.tensorFormat = "RGBA";
          tensorConfig.height = height;
          tensorConfig.width = width;
        }
        canvas.width = width;
        canvas.height = height;
        pixels2DContext.drawImage(image, 0, 0, width, height);
        data = pixels2DContext.getImageData(0, 0, width, height).data;
      } else {
        throw new Error("Can not access image data");
      }
    } else if (isImageDataEle) {
      const format = "RGBA";
      let height;
      let width;
      if (
        options !== undefined &&
        options.resizedWidth !== undefined &&
        options.resizedHeight !== undefined
      ) {
        height = options.resizedHeight;
        width = options.resizedWidth;
      } else {
        height = image.height;
        width = image.width;
      }
      if (options !== undefined) {
        tensorConfig = options;
        if (
          options.bitmapFormat !== undefined &&
          options.bitmapFormat !== format
        ) {
          throw new Error(
            "Image input config format must be RGBA for ImageData"
          );
        } else {
          tensorConfig.bitmapFormat = "RGBA";
        }
      } else {
        tensorConfig.bitmapFormat = "RGBA";
      }
      tensorConfig.height = height;
      tensorConfig.width = width;
      if (options !== undefined) {
        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = width;
        tempCanvas.height = height;
        const pixels2DContext = tempCanvas.getContext("2d");
        if (pixels2DContext != null) {
          pixels2DContext.putImageData(image, 0, 0);
          data = pixels2DContext.getImageData(0, 0, width, height).data;
        } else {
          throw new Error("Can not access image data");
        }
      } else {
        data = image.data;
      }
    } else if (isImageBitmap) {
      if (options === undefined) {
        throw new Error(
          "Please provide image config with format for Imagebitmap"
        );
      }
      if (options.bitmapFormat !== undefined) {
        throw new Error(
          "Image input config format must be defined for ImageBitmap"
        );
      }
      const pixels2DContext = document.createElement("canvas").getContext("2d");
      if (pixels2DContext != null) {
        const height = image.height;
        const width = image.width;
        pixels2DContext.drawImage(image, 0, 0, width, height);
        data = pixels2DContext.getImageData(0, 0, width, height).data;
        if (options !== undefined) {
          if (options.height !== undefined && options.height !== height) {
            throw new Error(
              "Image input config height doesn't match ImageBitmap height"
            );
          } else {
            tensorConfig.height = height;
          }

          if (options.width !== undefined && options.width !== width) {
            throw new Error(
              "Image input config width doesn't match ImageBitmap width"
            );
          } else {
            tensorConfig.width = width;
          }
        } else {
          tensorConfig.height = height;
          tensorConfig.width = width;
        }
        return Tensor.bufferToTensor(data, tensorConfig);
      } else {
        throw new Error("Can not access image data");
      }
    } else if (isURL) {
      return new Promise((resolve, reject) => {
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        if (!image || !context) {
          return reject();
        }

          resolve(Tensor.bufferToTensor(img.data, tensorConfig));
        };
      });
    } else {
      throw new Error(
        "Input data provided is not supported - aborted tensor creation"
      );
    }
    if (data !== undefined) {
      return Tensor.bufferToTensor(data, tensorConfig);
    } else {
      throw new Error(
        "Input data provided is not supported - aborted tensor creation"
      );
    }
  }
  toImageData(options) {
    var _a, _b;
    const pixels2DContext = document.createElement("canvas").getContext("2d");
    let image;
    if (pixels2DContext != null) {
      const width = this.dims[3];
      const height = this.dims[2];
      const channels = this.dims[1];
      const inputformat =
        options !== undefined
          ? options.format !== undefined
            ? options.format
            : "RGB"
          : "RGB";
      const normMean =
        options !== undefined
          ? ((_a = options.norm) === null || _a === void 0
              ? void 0
              : _a.mean) !== undefined
            ? options.norm.mean
            : 255
          : 255;
      const normBias =
        options !== undefined
          ? ((_b = options.norm) === null || _b === void 0
              ? void 0
              : _b.bias) !== undefined
            ? options.norm.bias
            : 0
          : 0;
      const offset = height * width;
      if (options !== undefined) {
        if (options.height !== undefined && options.height !== height) {
          throw new Error(
            "Image output config height doesn't match tensor height"
          );
        }
        if (options.width !== undefined && options.width !== width) {
          throw new Error(
            "Image output config width doesn't match tensor width"
          );
        }
        if (
          (options.format !== undefined &&
            channels === 4 &&
            options.format !== "RGBA") ||
          (channels === 3 &&
            options.format !== "RGB" &&
            options.format !== "BGR")
        ) {
          throw new Error("Tensor format doesn't match input tensor dims");
        }
      }

      const step = 4;
      let rImagePointer = 0,
        gImagePointer = 1,
        bImagePointer = 2,
        aImagePointer = 3;
      let rTensorPointer = 0,
        gTensorPointer = offset,
        bTensorPointer = offset * 2,
        aTensorPointer = -1;

      if (inputformat === "RGBA") {
        rTensorPointer = 0;
        gTensorPointer = offset;
        bTensorPointer = offset * 2;
        aTensorPointer = offset * 3;
      } else if (inputformat === "RGB") {
        rTensorPointer = 0;
        gTensorPointer = offset;
        bTensorPointer = offset * 2;
      } else if (inputformat === "RBG") {
        rTensorPointer = 0;
        bTensorPointer = offset;
        gTensorPointer = offset * 2;
      }
      image = pixels2DContext.createImageData(width, height);
      for (
        let i = 0;
        i < height * width;
        rImagePointer += step,
          gImagePointer += step,
          bImagePointer += step,
          aImagePointer += step,
          i++
      ) {
        image.data[rImagePointer] =
          (this.data[rTensorPointer++] - normBias) * normMean;
        image.data[gImagePointer] =
          (this.data[gTensorPointer++] - normBias) * normMean;
        image.data[bImagePointer] =
          (this.data[bTensorPointer++] - normBias) * normMean;
        image.data[aImagePointer] =
          aTensorPointer === -1
            ? 255
            : (this.data[aTensorPointer++] - normBias) * normMean;
      }
    } else {
      throw new Error("Can not access image data");
    }
    return image;
  }

  reshape(dims) {
    return new Tensor(this.type, this.data, dims);
  }
}
