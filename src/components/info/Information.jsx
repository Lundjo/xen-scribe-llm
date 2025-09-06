import React, { useState, useEffect } from "react";
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
  const [translationError, setTranslationError] = useState("");

  const originalText = output.map((val) => val.text).join(" ");
  const textElement = tab === "transcription" ? originalText : translatedText;

  useEffect(() => {
    if (tab === "translation" && !translator) {
      initializeTranslator();
    }
  }, [tab, translator]);

  const initializeTranslator = async () => {
    setIsTranslatorLoading(true);
    setTranslationError("");
    
    try {
      const translationPipeline = await pipeline(
        "translation",
        "Xenova/t5-small"
      );
      
      setTranslator(() => translationPipeline);
    } catch (error) {
      setTranslationError("Neuspešno učitavanje modela za prevođenje. Pokušajte ponovo.");
    } finally {
      setIsTranslatorLoading(false);
    }
  };

  const translateWithAPI = async (text, targetLang) => {
    setTranslating(true);
    setTranslationError("");
    
    try {
      const response = await fetch("https://api.mymemory.translated.net/get", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          q: text,
          langpair: `en|${targetLang}`
        })
      });
      
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        setTranslatedText(data.responseData.translatedText);
      } else {
        throw new Error("API prevod nije uspeo");
      }
    } catch (error) {
      setTranslationError("Došlo je do greške pri prevođenju. Pokušajte ponovo.");
      setTranslatedText(originalText);
    } finally {
      setTranslating(false);
    }
  };

  const translateWithModel = async (text, targetLang) => {
    if (!translator || text.trim().length === 0) {
      return;
    }

    setTranslating(true);
    setTranslationError("");
    
    try {
      const langPrefixes = {
        fr: "translate English to French: ",
        de: "translate English to German: ",
      };
      
      const prefix = langPrefixes[targetLang];
      
      const result = await translator(prefix + text);
      
      setTranslatedText(result[0].translation_text);
    } catch (error) {
      setTranslationError("Došlo je do greške pri prevođenju. Pokušajte ponovo.");
      setTranslatedText(originalText);
    } finally {
      setTranslating(false);
    }
  };

  const translateText = async (text, targetLang) => {
    const modelLanguages = ["fr", "de"];
    
    if (modelLanguages.includes(targetLang)) {
      translateWithModel(text, targetLang);
    } else {
      translateWithAPI(text, targetLang);
    }
  };

  useEffect(() => {
    if (tab === "translation" && translator && originalText.length > 0) {
      translateText(originalText, targetLanguage);
    } else if (tab === "translation" && originalText.length > 0 && !translator && !isTranslatorLoading) {
      initializeTranslator();
    }
  }, [tab, targetLanguage, originalText, translator]);

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

  const handleRetryTranslation = () => {
    setTranslationError("");
    if (originalText.length > 0) {
      translateText(originalText, targetLanguage);
    }
  };

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
          disabled={isTranslatorLoading}
          className={`w-1/2 py-2 transition duration-200 ${
            tab === "translation"
              ? "bg-primary-500 text-white"
              : "text-primary-300 hover:bg-primary-600 hover:text-white"
          } disabled:opacity-50 disabled:cursor-not-allowed`}
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
              className="bg-white/10 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-white/20 appearance-none px-3 py-2 w-40"
              disabled={translating || isTranslatorLoading}
            >
              <option value="sr">Srpski</option>
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
        
        {translationError && (
          <div className="bg-red-500/20 border border-red-500 rounded-lg p-4 text-red-200 w-full">
            <p>{translationError}</p>
            <button 
              onClick={handleRetryTranslation}
              className="mt-2 px-4 py-2 bg-red-600 hover:bg-red-700 rounded-md text-white transition"
            >
              Pokušaj Ponovo
            </button>
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