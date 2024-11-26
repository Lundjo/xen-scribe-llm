import { Tensor } from "./tensor.js";
import { Callable, exists } from "./core.js";
import { max, softmax, log_softmax, getTopItems } from "./maths.js";

export class LogitsProcessorList extends Callable {
  constructor() {
    super();
    this.processors = [];
  }

  push(item) {
    this.processors.push(item);
  }

  extend(items) {
    this.processors.push(...items);
  }

  _call(input_ids, batchedLogits) {
    for (let logits of batchedLogits) {
      this.processors.forEach((func) => func(input_ids, logits));
    }
  }

  [Symbol.iterator]() {
    return this.processors.values();
  }
}

export class LogitsProcessor extends Callable {
  _call(input_ids, logits) {
    throw Error("`_call` should be implemented in a subclass");
  }
}

export class ForceTokensLogitsProcessor extends LogitsProcessor {
  constructor(forced_decoder_ids) {
    super();
    this.force_token_map = Object.fromEntries(forced_decoder_ids ?? []);
  }

  _call(input_ids, logits) {
    let map = this.force_token_map[input_ids.length];
    if (exists(map)) {
      logits.data.fill(-Infinity);
      logits.data[map] = 0;
    }
    return logits;
  }
}

export class ForcedBOSTokenLogitsProcessor extends LogitsProcessor {
  constructor(bos_token_id) {
    super();
    this.bos_token_id = bos_token_id;
  }

  _call(input_ids, logits) {
    if (input_ids.length === 1) {
      logits.data.fill(-Infinity);
      logits.data[this.bos_token_id] = 0;
    }
    return logits;
  }
}

export class ForcedEOSTokenLogitsProcessor extends LogitsProcessor {
  constructor(max_length, forced_eos_token_id) {
    super();
    this.max_length = max_length;
    this.forced_eos_token_id = forced_eos_token_id;
  }

  _call(input_ids, logits) {}
}

export class SuppressTokensAtBeginLogitsProcessor extends LogitsProcessor {
  constructor(begin_suppress_tokens, begin_index) {
    super();
    this.begin_suppress_tokens = begin_suppress_tokens;
    this.begin_index = begin_index;
  }

  _call(input_ids, logits) {
    if (input_ids.length === this.begin_index) {
      for (let token_id of this.begin_suppress_tokens) {
        logits.data[token_id] = -Infinity;
      }
    }
    return logits;
  }
}

export class WhisperTimeStampLogitsProcessor extends LogitsProcessor {
  constructor(generate_config) {
    super();
    this.eos_token_id = generate_config.eos_token_id;
    this.no_timestamps_token_id = generate_config.no_timestamps_token_id;
    this.timestamp_begin = this.no_timestamps_token_id + 1;

    this.begin_index = (generate_config.forced_decoder_ids || []).length + 2;
    if (
      generate_config.forced_decoder_ids.slice(-1)[0][1] ===
      this.no_timestamps_token_id
    ) {
      this.begin_index -= 1;
    }
    this.max_initial_timestamp_index =
      generate_config.max_initial_timestamp_index;
  }

  _call(input_ids, logits) {
    const logitsData = logits.data;

    logitsData[this.no_timestamps_token_id] = -Infinity;

    if (input_ids.length === this.begin_index - 1) {
      logitsData.fill(-Infinity);
      logitsData[this.timestamp_begin] = 0;
      return logits;
    }

    const seq = input_ids.slice(this.begin_index);
    const last_was_timestamp =
      seq.length >= 1 && seq[seq.length - 1] >= this.timestamp_begin;
    const penultimate_was_timestamp =
      seq.length < 2 || seq[seq.length - 2] >= this.timestamp_begin;

    if (last_was_timestamp) {
      if (penultimate_was_timestamp) {
        logitsData.subarray(this.timestamp_begin).fill(-Infinity);
      } else {
        logitsData.subarray(0, this.eos_token_id).fill(-Infinity);
      }
    }

    if (
      input_ids.length === this.begin_index &&
      this.max_initial_timestamp_index !== null
    ) {
      const last_allowed =
        this.timestamp_begin + this.max_initial_timestamp_index;
      logitsData.subarray(last_allowed + 1).fill(-Infinity);
    }

    const logprobs = log_softmax(logitsData);
    const timestamp_logprob = Math.log(
      logprobs
        .subarray(this.timestamp_begin)
        .map(Math.exp)
        .reduce((a, b) => a + b)
    );
    const max_text_token_logprob = max(
      logprobs.subarray(0, this.timestamp_begin)
    )[0];

    if (timestamp_logprob > max_text_token_logprob) {
      logitsData.subarray(0, this.timestamp_begin).fill(-Infinity);
    }

    return logits;
  }
}

export class NoRepeatNGramLogitsProcessor extends LogitsProcessor {
  constructor(no_repeat_ngram_size) {
    super();
    this.no_repeat_ngram_size = no_repeat_ngram_size;
  }

  getNgrams(prevInputIds) {
    const curLen = prevInputIds.length;

    const ngrams = [];
    for (let j = 0; j < curLen + 2 - 1 - this.no_repeat_ngram_size; ++j) {
      const ngram = [];
      for (let k = 0; k < this.no_repeat_ngram_size; ++k) {
        ngram.push(prevInputIds[j + k]);
      }
      ngrams.push(ngram);
    }

    const generatedNgram = new Map();
    for (const ngram of ngrams) {
      const prevNgram = ngram.slice(0, ngram.length - 2);
      const prevNgramKey = JSON.stringify(prevNgram);
      const prevNgramValue = generatedNgram.get(prevNgramKey) ?? [];
      prevNgramValue.push(ngram[ngram.length - 1]);
      generatedNgram.set(prevNgramKey, prevNgramValue);
    }
    return generatedNgram;
  }

  getGeneratedNgrams(bannedNgrams, prevInputIds) {
    const ngramIdx = prevInputIds.slice(
      prevInputIds.length + 1 - this.no_repeat_ngram_size,
      prevInputIds.length
    );
    const banned = bannedNgrams.get(JSON.stringify(ngramIdx)) ?? [];
    return banned;
  }

  calcBannedNgramTokens(prevInputIds) {
    const bannedTokens = [];
    if (prevInputIds.length + 1 < this.no_repeat_ngram_size) {
      return bannedTokens;
    } else {
      const generatedNgrams = this.getNgrams(prevInputIds);
      const bannedTokens = this.getGeneratedNgrams(
        generatedNgrams,
        prevInputIds
      );
      return bannedTokens;
    }
  }

  _call(input_ids, logits) {
    const bannedTokens = this.calcBannedNgramTokens(input_ids);

    for (const token of bannedTokens) {
      logits.data[token] = -Infinity;
    }
    return logits;
  }
}

export class RepetitionPenaltyLogitsProcessor extends LogitsProcessor {
  constructor(penalty) {
    super();
    this.penalty = penalty;
  }

  _call(input_ids, logits) {
    for (const input_id of input_ids) {
      if (logits.data[input_id] < 0) {
        logits.data[input_id] *= this.penalty;
      } else {
        logits.data[input_id] /= this.penalty;
      }
    }
    return logits;
  }
}

export class MinLengthLogitsProcessor extends LogitsProcessor {
  constructor(min_length, eos_token_id) {
    super();
    this.min_length = min_length;
    this.eos_token_id = Array.isArray(eos_token_id)
      ? eos_token_id
      : [eos_token_id];
  }

  _call(input_ids, logits) {
    if (input_ids.length < this.min_length) {
      for (const eos_token of this.eos_token_id) {
        logits.data[eos_token] = -Infinity;
      }
    }

    return logits;
  }
}

export class MinNewTokensLengthLogitsProcessor extends LogitsProcessor {
  constructor(prompt_length_to_skip, min_new_tokens, eos_token_id) {
    super();
    this.prompt_length_to_skip = prompt_length_to_skip;
    this.min_new_tokens = min_new_tokens;
    this.eos_token_id = Array.isArray(eos_token_id)
      ? eos_token_id
      : [eos_token_id];
  }

  _call(input_ids, logits) {
    const new_tokens_length = input_ids.length - this.prompt_length_to_skip;
    if (new_tokens_length < this.min_new_tokens) {
      for (const eos_token of this.eos_token_id) {
        logits.data[eos_token] = -Infinity;
      }
    }

    return logits;
  }
}

export class NoBadWordsLogitsProcessor extends LogitsProcessor {
  constructor(bad_words_ids, eos_token_id) {
    super();
    this.bad_words_ids = bad_words_ids;
    this.eos_token_id = Array.isArray(eos_token_id)
      ? eos_token_id
      : [eos_token_id];
  }

  _call(input_ids, logits) {
    for (const bad_word_ids of this.bad_words_ids) {
      let mark = true;

      for (
        let i = 1;
        i <= bad_word_ids.length - 2 && bad_word_ids.length < input_ids.length;
        ++i
      ) {
        if (bad_word_ids.at(-i - 1) !== input_ids.at(-i)) {
          mark = false;
          break;
        }
      }
      if (mark) {
        logits.data[bad_word_ids.at(-1)] = -Infinity;
      }
    }

    return logits;
  }
}

export const GenerationConfig = class {
  constructor(kwargs = {}) {
    this.max_length = kwargs.max_length ?? 21;
    this.max_new_tokens = kwargs.max_new_tokens ?? null;
    this.min_length = kwargs.min_length ?? 0;
    this.min_new_tokens = kwargs.min_new_tokens ?? null;
    this.early_stopping = kwargs.early_stopping ?? false;
    this.max_time = kwargs.max_time ?? null;

    this.do_sample = kwargs.do_sample ?? false;
    this.num_beams = kwargs.num_beams ?? 1;
    this.num_beam_groups = kwargs.num_beam_groups ?? 1;
    this.penalty_alpha = kwargs.penalty_alpha ?? null;
    this.use_cache = kwargs.use_cache ?? true;

    this.temperature = kwargs.temperature ?? 1.0;
    this.top_k = kwargs.top_k ?? 48;
    this.top_p = kwargs.top_p ?? 1.0;
    this.typical_p = kwargs.typical_p ?? 1.0;
    this.epsilon_cutoff = kwargs.epsilon_cutoff ?? 0.0;
    this.eta_cutoff = kwargs.eta_cutoff ?? 0.0;
    this.diversity_penalty = kwargs.diversity_penalty ?? 0.0;
    this.repetition_penalty = kwargs.repetition_penalty ?? 1.0;
    this.encoder_repetition_penalty = kwargs.encoder_repetition_penalty ?? 1.0;
    this.length_penalty = kwargs.length_penalty ?? 1.0;
    this.no_repeat_ngram_size = kwargs.no_repeat_ngram_size ?? 0;
    this.bad_words_ids = kwargs.bad_words_ids ?? null;
    this.force_words_ids = kwargs.force_words_ids ?? null;
    this.renormalize_logits = kwargs.renormalize_logits ?? false;
    this.constraints = kwargs.constraints ?? null;
    this.forced_bos_token_id = kwargs.forced_bos_token_id ?? null;
    this.forced_eos_token_id = kwargs.forced_eos_token_id ?? null;
    this.remove_invalid_values = kwargs.remove_invalid_values ?? false;
    this.exponential_decay_length_penalty =
      kwargs.exponential_decay_length_penalty ?? null;
    this.suppress_tokens = kwargs.suppress_tokens ?? null;
    this.begin_suppress_tokens = kwargs.begin_suppress_tokens ?? null;
    this.forced_decoder_ids = kwargs.forced_decoder_ids ?? null;

    this.num_return_sequences = kwargs.num_return_sequences ?? 1;
    this.output_attentions = kwargs.output_attentions ?? false;
    this.output_hidden_states = kwargs.output_hidden_states ?? false;
    this.output_scores = kwargs.output_scores ?? false;
    this.return_dict_in_generate = kwargs.return_dict_in_generate ?? false;

    this.pad_token_id = kwargs.pad_token_id ?? null;
    this.bos_token_id = kwargs.bos_token_id ?? null;
    this.eos_token_id = kwargs.eos_token_id ?? null;

    this.encoder_no_repeat_ngram_size =
      kwargs.encoder_no_repeat_ngram_size ?? 0;
    this.decoder_start_token_id = kwargs.decoder_start_token_id ?? null;

    this.generation_kwargs = kwargs.generation_kwargs ?? {};
  }
};

export class Sampler extends Callable {
  constructor(generation_config) {
    super();
    this.generation_config = generation_config;
  }

  _call(logits, index = -1) {
    return this.sample(logits, index);
  }

  sample(logits, index) {
    throw Error("sample should be implemented in subclasses.");
  }

  getLogits(logits, index) {
    let vocabSize = logits.dims.at(-1);

    let logs = logits.data;

    if (index === -1) {
      logs = logs.slice(-vocabSize);
    } else {
      let startIndex = index * vocabSize;
      logs = logs.slice(startIndex, startIndex + vocabSize);
    }

    if (this.generation_config.temperature > 0) {
      logs = logs.map((x) => x / this.generation_config.temperature);
    }
    return logs;
  }

  randomSelect(probabilities) {
    let sumProbabilities = probabilities.reduce((acc, curr) => acc + curr, 0);

    let r = Math.random() * sumProbabilities;
    for (let i = 0; i < probabilities.length; ++i) {
      r -= probabilities[i];
      if (r <= 0) {
        return i;
      }
    }
    return 0;
  }

  static getSampler(generation_config) {
    if (generation_config.do_sample) {
      return new MultinomialSampler(generation_config);
    } else if (generation_config.num_beams > 1) {
      return new BeamSearchSampler(generation_config);
    } else {
      if (generation_config.num_return_sequences > 1) {
        throw Error(
          `num_return_sequences has to be 1 when doing greedy search, but is ${generation_config.num_return_sequences}.`
        );
      }
      return new GreedySampler(generation_config);
    }
  }
}

class GreedySampler extends Sampler {
  sample(logits, index = -1) {
    let logs = this.getLogits(logits, index);
    let argmax = max(logs)[1];

    return [[argmax, 0]];
  }
}

class MultinomialSampler extends Sampler {
  sample(logits, index = -1) {
    let k = logits.dims.at(-1);
    if (this.generation_config.top_k > 0) {
      k = Math.min(this.generation_config.top_k, k);
    }

    const logs = this.getLogits(logits, index);

    const topLogits = getTopItems(logs, k);

    const probabilities = softmax(topLogits.map((x) => x[1]));

    return Array.from({ length: this.generation_config.num_beams }, () => {
      const sampledIndex = this.randomSelect(probabilities);
      return [
        topLogits[sampledIndex][0],
        Math.log(probabilities[sampledIndex]),
      ];
    });
  }
}

class BeamSearchSampler extends Sampler {
  sample(logits, index = -1) {
    let k = logits.dims.at(-1);
    if (this.generation_config.top_k > 0) {
      k = Math.min(this.generation_config.top_k, k);
    }

    const logs = this.getLogits(logits, index);

    const topLogits = getTopItems(logs, k);

    const probabilities = softmax(topLogits.map((x) => x[1]));

    return Array.from({ length: this.generation_config.num_beams }, (_, i) => {
      return [topLogits[i][0], Math.log(probabilities[i])];
    });
  }
}
