import React, { useState, useEffect } from "react";
import Transcription from "../transcribe/Transcription";

export default function Information(props) {
  const { output, finished } = props;
  const [tab, setTab] = useState("transcription");
  const [translating, setTranslating] = useState(false);
  const [translatedText, setTranslatedText] = useState("");
  const [targetLanguage, setTargetLanguage] = useState("sr");
  const [translationError, setTranslationError] = useState("");

  const originalText = output.map((val) => val.text).join(" ");
  const textElement = tab === "transcription" ? originalText : translatedText;

  const translateWithAPI = async (text, targetLang) => {
    if (text.trim().length === 0) {
      return;
    }

    setTranslating(true);
    setTranslationError("");
    setTranslatedText(""); // Resetuj prethodni prevod
    
    try {
      const langCodes = {
        sr: "sr",
        es: "es", 
        fr: "fr",
        de: "de",
        it: "it"
      };
      
      const langpair = `en|${langCodes[targetLang]}`;
      const encodedText = encodeURIComponent(text);
      
      const response = await fetch(`https://api.mymemory.translated.net/get?q=${encodedText}&langpair=${langpair}`);
      
      if (!response.ok) {
        throw new Error("API greška");
      }
      
      const data = await response.json();
      
      if (data.responseStatus === 200) {
        setTranslatedText(data.responseData.translatedText);
      } else {
        throw new Error("API prevod nije uspeo");
      }
    } catch (error) {
      setTranslationError("Došlo je do greške pri prevođenju. Pokušajte ponovo.");
    } finally {
      setTranslating(false);
    }
  };

  useEffect(() => {
    if (tab === "translation" && originalText.length > 0) {
      translateWithAPI(originalText, targetLanguage);
    } else if (tab === "translation") {
      setTranslatedText(""); // Resetuj prevod ako nema teksta
    }
  }, [tab, targetLanguage, originalText]);

  const handleLanguageChange = (e) => {
    setTargetLanguage(e.target.value);
    setTranslatedText(""); // Resetuj prethodni prevod pri promeni jezika
  };

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
      translateWithAPI(originalText, targetLanguage);
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
              onChange={handleLanguageChange}
              className="bg-gray-800 text-white rounded-md p-2 focus:outline-none focus:ring-2 focus:ring-primary-500 border border-gray-600 px-3 py-2 w-40"
              disabled={translating}
            >
              <option value="sr">Srpski</option>
              <option value="es">Španski</option>
              <option value="fr">Francuski</option>
              <option value="de">Nemački</option>
              <option value="it">Italijanski</option>
            </select>
          </div>
        </div>
      )}

      <div className="my-8 flex flex-col items-center w-full gap-6">
        {(!finished || translating) && (
          <div className="grid place-items-center animate-pulse">
            <i className="fa-solid fa-spinner text-primary-400 text-4xl animate-spin"></i>
            <span className="text-white mt-2">
              {translating ? "Prevodim..." : "Transkribujem..."}
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
          disabled={translating || textElement.length === 0}
          className="py-2 px-4 bg-white/10 rounded-xl hover:bg-primary-600 transition text-primary-400 hover:text-white shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-copy"></i>
        </button>
        <button
          onClick={handleDownload}
          title="Download"
          disabled={translating || textElement.length === 0}
          className="py-2 px-4 bg-white/10 rounded-xl hover:bg-primary-600 transition text-primary-400 hover:text-white shadow-lg transform hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="fa-solid fa-download"></i>
        </button>
      </div>
    </main>
  );
}