import React, { useState, useEffect, useRef } from "react";
import Transcription from "../transcribe/Transcription";

export default function Information(props) {
  const { output, finished } = props;
  const [tab, setTab] = useState("transcription");
  const [translating, setTranslating] = useState(null);

  const worker = useRef();

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL("../utils/translate.worker.js", import.meta.url),
        { type: "module" }
      );
    }

    const onMessageReceived = async (e) => {
      switch (e.data.status) {
        case "initiate":
          break;
        case "progress":
          break;
        case "update":
          setTranslation(e.data.output);
          break;
        case "complete":
          setTranslating(false);
          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  }, []);

  const textElement =
    tab === "transcription" ? output.map((val) => val.text) : "";

  function handleCopy() {
    navigator.clipboard.writeText(textElement);
  }

  function handleDownload() {
    const element = document.createElement("a");
    const file = new Blob([textElement], { type: "text/plain" });
    element.href = URL.createObjectURL(file);
    element.download = `transcribed_${Date.now().toString()}.txt`;
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
          className={`w-full py-2 transition duration-200 ${
            tab === "transcription"
              ? "bg-primary-500 text-white"
              : "text-primary-300 hover:bg-primary-600 hover:text-white"
          }`}
        >
          Transkript
        </button>
      </div>

      <div className="my-8 flex flex-col items-center w-full gap-6">
        {(!finished || translating) && (
          <div className="grid place-items-center animate-pulse">
            <i className="fa-solid fa-spinner text-primary-400 text-4xl"></i>
          </div>
        )}
        <Transcription {...props} textElement={textElement} />
      </div>

      <div className="flex gap-4 justify-center">
        <button
          onClick={handleCopy}
          title="Copy"
          className="py-2 px-4 bg-white/10 rounded-xl hover:bg-primary-600 transition text-primary-400 hover:text-white shadow-lg transform hover:scale-105"
        >
          <i className="fa-solid fa-copy"></i>
        </button>
        <button
          onClick={handleDownload}
          title="Download"
          className="py-2 px-4 bg-white/10 rounded-xl hover:bg-primary-600 transition text-primary-400 hover:text-white shadow-lg transform hover:scale-105"
        >
          <i className="fa-solid fa-download"></i>
        </button>
      </div>
    </main>
  );
}
