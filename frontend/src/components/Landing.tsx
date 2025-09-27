import { useEffect, useRef, useState } from "react";
import { Room } from "./Room";
import { motion } from "framer-motion";
import { io, Socket } from "socket.io-client";

const URL = import.meta.env.VITE_SOCKET_URL || "http://localhost:3000";

export const Landing = () => {
  const [name, setName] = useState("");
  const [localAudioTrack, setLocalAudioTrack] =
    useState<MediaStreamTrack | null>(null);
  const [localVideoTrack, setLocalVideoTrack] =
    useState<MediaStreamTrack | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const [joined, setJoined] = useState(false);

  const [socket, setSocket] = useState<Socket | null>(null);

  useEffect(() => {
    const s = io(URL);
    setSocket(s);

    // optional: clean up on unmount
    return () => {
      s.disconnect();
    };
  }, []);

  const getCam = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true,
    });

    const audioTrack = stream.getAudioTracks()[0];
    const videoTrack = stream.getVideoTracks()[0];
    setLocalAudioTrack(audioTrack);
    setLocalVideoTrack(videoTrack);

    if (videoRef.current) {
      videoRef.current.srcObject = new MediaStream([videoTrack]);
      videoRef.current.play();
    }
  };

  useEffect(() => {
    getCam();
  }, []);

  if (!joined) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-6">
        <motion.div
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="bg-white rounded-2xl shadow-xl p-6 w-full max-w-md flex flex-col items-center gap-6"
        >
          <div className="w-full overflow-hidden rounded-xl shadow-md">
            <video
              ref={videoRef}
              autoPlay
              muted
              className="w-full h-64 object-cover rounded-xl"
            />
          </div>

          <input
            type="text"
            placeholder="Enter your name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400 transition"
          />

          <motion.button
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => {
              if (!socket) return; // safety
              setJoined(true);
              socket.emit("join", { name }); // send actual name to server
            }}
            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-semibold shadow-md hover:bg-indigo-700 transition"
          >
            Join
          </motion.button>
        </motion.div>
      </div>
    );
  }

  return (
    <Room
      name={name}
      localAudioTrack={localAudioTrack}
      localVideoTrack={localVideoTrack}
      socket={socket}
    />
  );
};
