import React, { useState, useEffect, useRef } from "react";
import Transcription from "../transcribe/Transcription";

export default function Information(props) {
  const { output, finished } = props;
  const [tab, setTab] = useState("transcription");
  const [translation, setTranslation] = useState(null);
  const [translating, setTranslating] = useState(null);

  const worker = useRef();

  useEffect(() => {}, []);

  const textElement =
    tab === "transcription" ? output.map((val) => val.text) : translation || "";

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
        {tab === "transcription" ? (
          <Transcription {...props} textElement={textElement} />
        ) : (
          <></>
        )}
      </div>
    </main>
  );
}
