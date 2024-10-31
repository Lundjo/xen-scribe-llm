import { useState, useRef, useEffect } from "react";
import HomePage from "./components/home/HomePage";
import Header from "./components/header/Header";
import FileDisplay from "./components/file_display/FileDisplay";
import Information from "./components/info/Information";
import Transcribing from "./components/transcribe/Transcribing";
import { MessageTypes } from "./utils/presets";

function App() {
  const [file, setFile] = useState(null);
  const [audioStream, setAudioStream] = useState(null);
  const [output, setOutput] = useState(null);
  const [downloading, setDownloading] = useState(false);
  const [loading, setLoading] = useState(false);
  const [finished, setFinished] = useState(false);

  const isAudioAvailable = file || audioStream;

  function handleAudioReset() {
    setFile(null);
    setAudioStream(null);
  }

  const worker = useRef(null);

  useEffect(() => {
    if (!worker.current) {
      worker.current = new Worker(
        new URL("./utils/whisper.worker.js", import.meta.url),
        {
          type: "module",
        }
      );
    }

    const onMessageReceived = async (e) => {
      switch (e.data.type) {
        case "DOWNLOADING":
          setDownloading(true);

          break;
        case "LOADING":
          setLoading(true);

          break;
        case "RESULT":
          setOutput(e.data.results);

          break;
        case "INFERENCE_DONE":
          setFinished(true);

          break;
      }
    };

    worker.current.addEventListener("message", onMessageReceived);

    return () =>
      worker.current.removeEventListener("message", onMessageReceived);
  });

  async function readAudioFrom(file) {
    const sampling_rate = 16000;
    const audioCTX = new AudioContext({ sampleRate: sampling_rate });
    const response = await file.arrayBuffer();
    const decoded = await audioCTX.decodeAudioData(response);
    const audio = decoded.getChannelData(0);
    return audio;
  }

  async function handleFormSubmission() {
    if (!file && !audioStream) {
      return;
    }

    let audio = await readAudioFrom(file ? file : audioStream);
    const model_name = `openai/whisper-tiny.en`;

    worker.current.postMessage({
      type: MessageTypes.INFERENCE_REQUEST,
      audio,
      model_name,
    });
  }

  return (
    <div className="flex flex-col mx-auto justify-center items-center w-full p-4 bg-gradient-to-b from-gray-900 to-gray-800 overflow-hidden text-white">
      <section className="flex flex-col gap-8 min-h-screen">
        <Header />
        <main className="flex-1 flex justify-center items-center">
          {output ? (
            <Information output={output} finished={finished} />
          ) : loading ? (
            <Transcribing />
          ) : isAudioAvailable ? (
            <FileDisplay
              handleFormSubmission={handleFormSubmission}
              handleAudioReset={handleAudioReset}
              file={file}
              audioStream={audioStream}
            />
          ) : (
            <HomePage setFile={setFile} setAudioStream={setAudioStream} />
          )}
        </main>
      </section>
    </div>
  );
}

export default App;
