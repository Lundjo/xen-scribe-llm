import React, { useState, useEffect, useRef } from "react";

export default function HomePage(props) {
  const { setAudioStream, setFile } = props;

  const [recordingStatus, setRecordingStatus] = useState("inactive");
  const [audioChunks, setAudioChunks] = useState([]);
  const [duration, setDuration] = useState(0);

  const mediaRecorder = useRef(null);
  const mimeType = "audio/webm";

  async function startRecording() {
    let tempStream;
    try {
      const streamData = await navigator.mediaDevices.getUserMedia({
        audio: true,
        video: false,
      });
      tempStream = streamData;
    } catch (err) {
      return;
    }
    setRecordingStatus("recording");

    const media = new MediaRecorder(tempStream, { type: mimeType });
    mediaRecorder.current = media;

    mediaRecorder.current.start();
    let localAudioChunks = [];
    mediaRecorder.current.ondataavailable = (event) => {
      if (event.data.size > 0) localAudioChunks.push(event.data);
    };
    setAudioChunks(localAudioChunks);
  }

  async function stopRecording() {
    setRecordingStatus("inactive");

    mediaRecorder.current.stop();
    mediaRecorder.current.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      setAudioStream(audioBlob);
      setAudioChunks([]);
      setDuration(0);
    };
  }

  useEffect(() => {
    if (recordingStatus === "inactive") return;

    const interval = setInterval(() => {
      setDuration((curr) => curr + 1);
    }, 1000);

    return () => clearInterval(interval);
  }, [recordingStatus]);

  return (
    <main className="flex-1 p-4 flex flex-col gap-3  items-center text-center justify-center pb-20">
      <div className="p-6 rounded-xl bg-gray-600/20 backdrop-blur-lg shadow-2xl max-w-xl w-full">
        <h1 className="font-medium text-5xl sm:text-6xl md:text-6xl text-white mb-4">
          Xen<span className="text-primary-400">Scribe</span>
        </h1>
        <h3 className="font-medium text-lg text-white/80 mb-6">
          Snimi <span className="text-primary-400">&rarr;</span> Transkribuj
          <span className="text-red-500">*</span>
        </h3>
        <button
          onClick={
            recordingStatus === "recording" ? stopRecording : startRecording
          }
          className="flex items-center justify-center gap-x-4 px-6 py-3 rounded-lg shadow-lg transform hover:scale-105 transition-transform duration-200 bg-primary-500 mx-auto w-80 max-w-full mb-4"
        >
          <i
            className={`fa-solid fa-microphone ${
              recordingStatus === "recording"
                ? "text-red-500 animate-pulse"
                : "text-white/80"
            }`}
          ></i>
          <span>
            {recordingStatus === "inactive"
              ? "Pokreni audio snimanje"
              : "Zaustavi snimanje"}
          </span>
          <div className="flex items-center gap-2">
            {duration > 0 && (
              <p className="text-sm font-medium text-white/80 pr-1">
                {duration}s
              </p>
            )}
          </div>
        </button>
        <p className="italic text-sm text-slate-400 mt-2">
          <span className="text-red-500">*</span> samo engleski jezik
        </p>
      </div>
    </main>
  );
}
