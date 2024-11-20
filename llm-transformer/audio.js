import { getFile } from "./hub.js";
import { FFT, max } from "./maths.js";
import { calculateReflectOffset } from "./core.js";

export async function read_audio(url, sampling_rate) {
  if (typeof AudioContext === "undefined") {
    throw Error(
      "Unable to load audio from path/URL since `AudioContext` is not available in your environment. " +
        "Instead, audio data should be passed directly to the pipeline/processor. " +
        "For more information and some example code, see https://huggingface.co/docs/transformers.js/guides/node-audio-processing."
    );
  }

  const response = await (await getFile(url)).arrayBuffer();
  const audioCTX = new AudioContext({ sampleRate: sampling_rate });
  if (typeof sampling_rate === "undefined") {
    console.warn(
      `No sampling rate provided, using default of ${audioCTX.sampleRate}Hz.`
    );
  }
  const decoded = await audioCTX.decodeAudioData(response);

  let audio;

  if (decoded.numberOfChannels === 2) {
    const SCALING_FACTOR = Math.sqrt(2);

    const left = decoded.getChannelData(0);
    const right = decoded.getChannelData(1);

    audio = new Float32Array(left.length);
    for (let i = 0; i < decoded.length; ++i) {
      audio[i] = (SCALING_FACTOR * (left[i] + right[i])) / 2;
    }
  } else {
    audio = decoded.getChannelData(0);
  }

  return audio;
}

export function hanning(M) {
  if (M < 1) {
    return new Float64Array();
  }
  if (M === 1) {
    return new Float64Array([1]);
  }
  const denom = M - 1;
  const factor = Math.PI / denom;
  const cos_vals = new Float64Array(M);
  for (let i = 0; i < M; ++i) {
    const n = 2 * i - denom;
    cos_vals[i] = 0.5 + 0.5 * Math.cos(factor * n);
  }
  return cos_vals;
}

const HERTZ_TO_MEL_MAPPING = {
  htk: (freq) => 2595.0 * Math.log10(1.0 + freq / 700.0),
  kaldi: (freq) => 1127.0 * Math.log(1.0 + freq / 700.0),
  slaney: (
    freq,
    min_log_hertz = 1000.0,
    min_log_mel = 15.0,
    logstep = 27.0 / Math.log(6.4)
  ) =>
    freq >= min_log_hertz
      ? min_log_mel + Math.log(freq / min_log_hertz) * logstep
      : (3.0 * freq) / 200.0,
};

function hertz_to_mel(freq, mel_scale = "htk") {
  const fn = HERTZ_TO_MEL_MAPPING[mel_scale];
  if (!fn) {
    throw new Error('mel_scale should be one of "htk", "slaney" or "kaldi".');
  }

  return typeof freq === "number" ? fn(freq) : freq.map((x) => fn(x));
}

const MEL_TO_HERTZ_MAPPING = {
  htk: (mels) => 700.0 * (10.0 ** (mels / 2595.0) - 1.0),
  kaldi: (mels) => 700.0 * (Math.exp(mels / 1127.0) - 1.0),
  slaney: (
    mels,
    min_log_hertz = 1000.0,
    min_log_mel = 15.0,
    logstep = Math.log(6.4) / 27.0
  ) =>
    mels >= min_log_mel
      ? min_log_hertz * Math.exp(logstep * (mels - min_log_mel))
      : (200.0 * mels) / 3.0,
};

function mel_to_hertz(mels, mel_scale = "htk") {
  const fn = MEL_TO_HERTZ_MAPPING[mel_scale];
  if (!fn) {
    throw new Error('mel_scale should be one of "htk", "slaney" or "kaldi".');
  }

  return typeof mels === "number" ? fn(mels) : mels.map((x) => fn(x));
}

function _create_triangular_filter_bank(fft_freqs, filter_freqs) {
  const filter_diff = Float64Array.from(
    { length: filter_freqs.length - 1 },
    (_, i) => filter_freqs[i + 1] - filter_freqs[i]
  );

  const slopes = Array.from(
    {
      length: fft_freqs.length,
    },
    () => new Array(filter_freqs.length)
  );

  for (let j = 0; j < fft_freqs.length; ++j) {
    const slope = slopes[j];
    for (let i = 0; i < filter_freqs.length; ++i) {
      slope[i] = filter_freqs[i] - fft_freqs[j];
    }
  }

  const numFreqs = filter_freqs.length - 2;
  const ret = Array.from(
    { length: numFreqs },
    () => new Array(fft_freqs.length)
  );

  for (let j = 0; j < fft_freqs.length; ++j) {
    const slope = slopes[j];
    for (let i = 0; i < numFreqs; ++i) {
      const down = -slope[i] / filter_diff[i];
      const up = slope[i + 2] / filter_diff[i + 1];
      ret[i][j] = Math.max(0, Math.min(down, up));
    }
  }
  return ret;
}

function linspace(start, end, num) {
  const step = (end - start) / (num - 1);
  return Float64Array.from({ length: num }, (_, i) => start + step * i);
}

export function mel_filter_bank(
  num_frequency_bins,
  num_mel_filters,
  min_frequency,
  max_frequency,
  sampling_rate,
  norm = null,
  mel_scale = "htk",
  triangularize_in_mel_space = false
) {
  if (norm !== null && norm !== "slaney") {
    throw new Error('norm must be one of null or "slaney"');
  }

  const mel_min = hertz_to_mel(min_frequency, mel_scale);
  const mel_max = hertz_to_mel(max_frequency, mel_scale);
  const mel_freqs = linspace(mel_min, mel_max, num_mel_filters + 2);

  let filter_freqs = mel_to_hertz(mel_freqs, mel_scale);
  let fft_freqs;

  if (triangularize_in_mel_space) {
    const fft_bin_width = sampling_rate / (num_frequency_bins * 2);
    fft_freqs = hertz_to_mel(
      Float64Array.from(
        { length: num_frequency_bins },
        (_, i) => i * fft_bin_width
      ),
      mel_scale
    );
    filter_freqs = mel_freqs;
  } else {
    fft_freqs = linspace(0, Math.floor(sampling_rate / 2), num_frequency_bins);
  }

  const mel_filters = _create_triangular_filter_bank(fft_freqs, filter_freqs);

  if (norm !== null && norm === "slaney") {
    for (let i = 0; i < num_mel_filters; ++i) {
      const filter = mel_filters[i];
      const enorm = 2.0 / (filter_freqs[i + 2] - filter_freqs[i]);
      for (let j = 0; j < num_frequency_bins; ++j) {
        filter[j] *= enorm;
      }
    }
  }

  return mel_filters;
}

function padReflect(array, left, right) {
  const padded = new array.constructor(array.length + left + right);
  const w = array.length - 1;

  for (let i = 0; i < array.length; ++i) {
    padded[left + i] = array[i];
  }

  for (let i = 1; i <= left; ++i) {
    padded[left - i] = array[calculateReflectOffset(i, w)];
  }

  for (let i = 1; i <= right; ++i) {
    padded[w + left + i] = array[calculateReflectOffset(w - i, w)];
  }

  return padded;
}

function _db_conversion_helper(
  spectrogram,
  factor,
  reference,
  min_value,
  db_range
) {
  if (reference <= 0) {
    throw new Error("reference must be greater than zero");
  }

  if (min_value <= 0) {
    throw new Error("min_value must be greater than zero");
  }

  reference = Math.max(min_value, reference);

  const logReference = Math.log10(reference);
  for (let i = 0; i < spectrogram.length; ++i) {
    spectrogram[i] =
      factor * Math.log10(Math.max(min_value, spectrogram[i]) - logReference);
  }

  if (db_range !== null) {
    if (db_range <= 0) {
      throw new Error("db_range must be greater than zero");
    }
    const maxValue = max(spectrogram)[0] - db_range;
    for (let i = 0; i < spectrogram.length; ++i) {
      spectrogram[i] = Math.max(spectrogram[i], maxValue);
    }
  }

  return spectrogram;
}

function amplitude_to_db(
  spectrogram,
  reference = 1.0,
  min_value = 1e-5,
  db_range = null
) {
  return _db_conversion_helper(
    spectrogram,
    20.0,
    reference,
    min_value,
    db_range
  );
}

function power_to_db(
  spectrogram,
  reference = 1.0,
  min_value = 1e-10,
  db_range = null
) {
  return _db_conversion_helper(
    spectrogram,
    10.0,
    reference,
    min_value,
    db_range
  );
}

export function spectrogram(
  waveform,
  window,
  frame_length,
  hop_length,
  {
    fft_length = null,
    power = 1.0,
    center = true,
    pad_mode = "reflect",
    onesided = true,
    preemphasis = null,
    mel_filters = null,
    mel_floor = 1e-10,
    log_mel = null,
    reference = 1.0,
    min_value = 1e-10,
    db_range = null,
    remove_dc_offset = null,

    max_num_frames = null,
    do_pad = true,
    transpose = false,
  } = {}
) {
  const window_length = window.length;
  if (fft_length === null) {
    fft_length = frame_length;
  }
  if (frame_length > fft_length) {
    throw Error(
      `frame_length (${frame_length}) may not be larger than fft_length (${fft_length})`
    );
  }

  if (window_length !== frame_length) {
    throw new Error(
      `Length of the window (${window_length}) must equal frame_length (${frame_length})`
    );
  }

  if (hop_length <= 0) {
    throw new Error("hop_length must be greater than zero");
  }

  if (power === null && mel_filters !== null) {
    throw new Error(
      "You have provided `mel_filters` but `power` is `None`. Mel spectrogram computation is not yet supported for complex-valued spectrogram. " +
        "Specify `power` to fix this issue."
    );
  }

  if (center) {
    if (pad_mode !== "reflect") {
      throw new Error(`pad_mode="${pad_mode}" not implemented yet.`);
    }
    const half_window = Math.floor((fft_length - 1) / 2) + 1;
    waveform = padReflect(waveform, half_window, half_window);
  }

  const num_frames = Math.floor(
    1 + Math.floor((waveform.length - frame_length) / hop_length)
  );

  const num_frequency_bins = onesided
    ? Math.floor(fft_length / 2) + 1
    : fft_length;

  let d1 = num_frames;
  let d1Max = num_frames;

  if (max_num_frames !== null) {
    if (max_num_frames > num_frames) {
      if (do_pad) {
        d1Max = max_num_frames;
      }
    } else {
      d1Max = d1 = max_num_frames;
    }
  }

  const fft = new FFT(fft_length);
  const inputBuffer = new Float64Array(fft_length);
  const outputBuffer = new Float64Array(fft.outputBufferSize);
  const magnitudes = new Array(d1);

  for (let i = 0; i < d1; ++i) {
    const offset = i * hop_length;
    for (let j = 0; j < frame_length; ++j) {
      inputBuffer[j] = waveform[offset + j];
    }

    if (remove_dc_offset) {
      let sum = 0;
      for (let j = 0; j < frame_length; ++j) {
        sum += inputBuffer[j];
      }
      const mean = sum / frame_length;
      for (let j = 0; j < frame_length; ++j) {
        inputBuffer[j] -= mean;
      }
    }

    if (preemphasis !== null) {
      for (let j = frame_length - 1; j >= 1; --j) {
        inputBuffer[j] -= preemphasis * inputBuffer[j - 1];
      }
      inputBuffer[0] *= 1 - preemphasis;
    }

    for (let j = 0; j < window.length; ++j) {
      inputBuffer[j] *= window[j];
    }

    fft.realTransform(outputBuffer, inputBuffer);

    const row = new Array(num_frequency_bins);
    for (let j = 0; j < row.length; ++j) {
      const j2 = j << 1;
      row[j] = outputBuffer[j2] ** 2 + outputBuffer[j2 + 1] ** 2;
    }
    magnitudes[i] = row;
  }

  if (power !== null && power !== 2) {
    const pow = 2 / power;
    for (let i = 0; i < magnitudes.length; ++i) {
      const magnitude = magnitudes[i];
      for (let j = 0; j < magnitude.length; ++j) {
        magnitude[j] **= pow;
      }
    }
  }

  const num_mel_filters = mel_filters.length;

  const mel_spec = new Float32Array(num_mel_filters * d1Max);

  const dims = transpose ? [d1Max, num_mel_filters] : [num_mel_filters, d1Max];
  for (let i = 0; i < num_mel_filters; ++i) {
    const filter = mel_filters[i];
    for (let j = 0; j < d1; ++j) {
      const magnitude = magnitudes[j];

      let sum = 0;
      for (let k = 0; k < num_frequency_bins; ++k) {
        sum += filter[k] * magnitude[k];
      }

      mel_spec[transpose ? j * num_mel_filters + i : i * d1 + j] = Math.max(
        mel_floor,
        sum
      );
    }
  }

  if (power !== null && log_mel !== null) {
    const o = Math.min(mel_spec.length, d1 * num_mel_filters);
    switch (log_mel) {
      case "log":
        for (let i = 0; i < o; ++i) {
          mel_spec[i] = Math.log(mel_spec[i]);
        }
        break;
      case "log10":
        for (let i = 0; i < o; ++i) {
          mel_spec[i] = Math.log10(mel_spec[i]);
        }
        break;
      case "dB":
        if (power === 1.0) {
          amplitude_to_db(mel_spec, reference, min_value, db_range);
        } else if (power === 2.0) {
          power_to_db(mel_spec, reference, min_value, db_range);
        } else {
          throw new Error(
            `Cannot use log_mel option '${log_mel}' with power ${power}`
          );
        }
        break;
      default:
        throw new Error(
          `log_mel must be one of null, 'log', 'log10' or 'dB'. Got '${log_mel}'`
        );
    }
  }

  return { data: mel_spec, dims };
}

export function window_function(
  window_length,
  name,
  { periodic = true, frame_length = null, center = true } = {}
) {
  const length = periodic ? window_length + 1 : window_length;
  let window;
  switch (name) {
    case "boxcar":
      window = new Float64Array(length).fill(1.0);
      break;
    case "hann":
    case "hann_window":
      window = hanning(length);
      break;
    case "povey":
      window = hanning(length).map((x) => Math.pow(x, 0.85));
      break;
    default:
      throw new Error(`Unknown window type ${name}.`);
  }
  if (periodic) {
    window = window.subarray(0, window_length);
  }
  if (frame_length === null) {
    return window;
  }
  if (window_length > frame_length) {
    throw new Error(
      `Length of the window (${window_length}) may not be larger than frame_length (${frame_length})`
    );
  }

  return window;
}
