import React, { useRef, useEffect } from "react";

export default function FileDisplay(props) {
  const { handleAudioReset, file, audioStream, handleFormSubmission } = props;
  const audioRef = useRef();

  useEffect(() => {
    if (!file && !audioStream) {
      return;
    }
    if (file) {
      audioRef.current.src = URL.createObjectURL(file);
    } else {
      audioRef.current.src = URL.createObjectURL(audioStream);
    }
  }, [audioStream, file]);

  return (
    <main className="flex flex-col items-center p-8 gap-6 text-center w-full max-w-lg mx-auto bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-lg rounded-xl shadow-lg border border-white/20">
      <h1 className="font-medium text-3xl sm:text-4xl md:text-4xl tracking-tight text-white">
        Priprema <span className="text-primary-400">Transkripcije</span>
      
            className="w-full h-10 rounded-lg outline-none accent-primary-400"
            controls
          >
            Your browser does not support the audio element.
          </audio>
        </div>
      </div>

      <div className="flex items-center justify-between w-full gap-6">
        <button
          onClick={handleAudioReset}
          className="text-slate-300 hover:text-primary-400 transition-colors duration-200"
        >
          Nazad
        </button>
        <button
          onClick={handleFormSubmission}
          className="flex items-center gap-2 px-4 py-2 bg-primary-500 text-white rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200"
        >
          <i className="fa-solid fa-pen-nib"></i> <p>Transkripcija</p>
        </button>
      </div>
    </main>
  );
}
