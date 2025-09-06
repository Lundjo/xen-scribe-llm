import React, { useState, useEffect, useRef } from "react";
import Transcription from "../transcribe/Transcription";
import { pipeline, env } from "@xenova/transformers";

env.allowLocalModels = false; 
env.backends.onnx.wasm.numThreads = 1;

export default function Information(props) {
  const { output, finished } = props;
  const [tab, setTab] = useState("transcription");
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("sr");
  const [translator, setTranslator] = useState(null);
  const [isTranslatorLoading, setIsTranslatorLoading] = useState(false);

  const textElement =
    tab === "transcription" 
      ? output.map((val) => val.text).join(" ") 
      : tab === "translation" 
        ? translatedText 
        : "";

  useEffect(() => {
    if (tab === "translation" && !translator) {
      initializeTranslator();
    }
  }, [tab, translator]);

  const initializeTranslator = async () => {
    setIsTranslatorLoading(true);
    try {
      const translationPipeline = await pipeline(
        "translation",
        "Xenova/nllb-200-distilled-600M"
      );
      setTranslator(translationPipeline);
    } catch (error) {
      console.error("Greška pri učitavanju translatora:", error);
    } finally {
      setIsTranslatorLoading(false);
    }
  };

  const translateText = async (text, targetLang) => {
    if (!translator || text.trim().length === 0) {
      return;
    }

    setTranslating(true);
    try {
      const langMap = {
        en: "eng_Latn",
        es: "spa_Latn", 
        fr: "fra_Latn",
        de: "deu_Latn",
        it: "ita_Latn",
        sr: "srp_Cyrl",
      };
      
      const modelLangCode = langMap[targetLang] || "srp_Cyrl";
      
      const result = await translator(text, {
        src_lang: "eng_Latn",
        tgt_lang: modelLangCode,
      });
      
      setTranslatedText(result[0].translation_text);
    } catch (error) {
      console.error("Greška pri prevođenju:", error);
      setTranslatedText("Došlo je do greške pri prevođenju. Pokušajte ponovo.");
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (tab === "translation" && translator && output.length > 0) {
      const textToTranslate = output.map(val => val.text).join(" ");
      if (textToTranslate.trim().length > 0) {
        translateText(textToTranslate, targetLanguage);
      }
    }
  }, [tab, targetLanguage, output, translator]);

  function handleCopy() {
    navigator.clipboard.writeText(textElement);
  }

  function handleDownload() {
    const element = document.createElement("a");
    const file = new Blob([textElement], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `${tab === "transcription" ? "transcribed" : "translated"}_${Date.now().toString()}.txt`;
    document.body.appendChild(element);
    element.click();
  }

  return (
    <main className="flex flex-col items-center p-8 gap-8 text-center max-w-prose w-full mx-auto bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-xl shadow-lg">
      <h1 className="font-normal bold text-3xl sm:text-4xl md:text-5xl text-white tracking-tight">
        Rezultat <span className="text-primary-400">Transkripcije</span>
      </h1>

      <div className="flex w-full justify-center bg-white/10 rounded-xl shadow-md overflow-hidden text-white font-semibold">
        <button
          onClick={() => setTab("transcription")}
          className={`w-1/2 py-2 transition duration-200 ${
            tab === "transcription"
              ? "bg-primary-500 text-white"
              : "text-primary-300 hover:bg-primary-600 hover:text-white"
          }`}
        >
          Transkript
        </button>
        <button
          onClick={() => setTab("translation")}
          className={`w-1/2 py-2 transition duration-200 ${
            tab === "translation"
              ? "bg-primary-500 text-white"
              : "text-primary-300 hover:bg-primary-600 hover:text-white"
          }`}
        >
          Prevod
        </button>
      </div>

      {tab === "translation" && (
        <div className="flex flex-col items-center gap-4 w-full">
          <div className="flex items-center gap-2">
            <span className="text-white">Prevedi na:</span>
            <select 
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)}
              className="bg-white/10 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-500"
              disabled={translating}
            >
              <option value="sr">Srpski</option>
              <option value="hr">Hrvatski</option>
              <option value="bs">Bosanski</option>
              <option value="es">Španski</option>
              <option value="fr">Francuski</option>
              <option value="de">Nemački</option>
              <option value="it">Italijanski</option>
            </select>
          </div>
          
          {isTranslatorLoading && (
            <div className="text-yellow-400 text-sm">
              Učitavam model za prevođenje... (prvi put može potrajati)
            </div>
          )}
        </div>
      )}

      <div className="my-8 flex flex-col items-center w-full gap-6">
        {(!finished || translating || isTranslatorLoading) && (
          <div className="grid place-items-center animate-pulse">
            <i className="fa-solid fa-spinner text-primary-400 text-4xl animate-spin"></i>
            <span className="text-white mt-2">
              {isTranslatorLoading 
                ? "Učitavam translator..." 
                : translating 
                  ? "Prevodim..." 
                  : "Transkribujem..."}
            </span>
          </div>
        )}
        <Transcription {...props} textElement={textElement} />
      </div>

      <div className="flex gap-4 justify-center">
        <button
          onClick={handleCopy}
          title="Copy"
          disabled={translating || isTranslatorLoading || textElement.length === 0}
          className="py-2 px-4 bg-white/10 rounded-xl hover:bg-primary-600 transition text-primary-400 hover:text-white shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-copy"></i>
        </button>
        <button
          onClick={handleDownload}
          title="Download"
          disabled={translating || isTranslatorLoading || textElement.length === 0}
          className="py-2 px-4 bg-white/10 rounded-xl hover:bg-primary-600 transition text-primary-400 hover:text-white shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-download"></i>
        </button>
      </div>
    </main>
  );
}