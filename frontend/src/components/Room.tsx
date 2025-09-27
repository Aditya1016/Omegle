import { useEffect, useRef, useState } from "react";
import { Socket } from "socket.io-client";
import { motion } from "framer-motion";

declare global {
  interface Window {
    pcr?: RTCPeerConnection;
  }
}

export const Room = ({
  name,
  localAudioTrack,
  localVideoTrack,
  socket,
}: {
  name: string;
  localAudioTrack: MediaStreamTrack | null;
  localVideoTrack: MediaStreamTrack | null;
  socket: Socket | null;
}) => {
  const [lobby, setLobby] = useState(true);
  const [, setSendingPc] = useState<null | RTCPeerConnection>(null);
  const [, setReceivingPc] = useState<null | RTCPeerConnection>(
    null
  );
  const [, setRemoteVideoTrack] =
    useState<MediaStreamTrack | null>(null);
  const [, setRemoteAudioTrack] =
    useState<MediaStreamTrack | null>(null);
  const [, setRemoteMediaStream] =
    useState<MediaStream | null>(null);
  const [remoteName, setRemoteName] = useState<string>("Stranger");

  const remoteVideoRef = useRef<HTMLVideoElement | null>(null);
  const localVideoRef = useRef<HTMLVideoElement | null>(null);

  useEffect(() => {
    if (!socket) return; // safety
    socket.on("send-offer", async ({ roomId, name: remoteUserName }) => {
      console.log("sending offer");
      setLobby(false);
      setRemoteName(remoteUserName); // <--- store remote name
      const pc = new RTCPeerConnection();

      setSendingPc(pc);
      if (localVideoTrack) pc.addTrack(localVideoTrack);
      if (localAudioTrack) pc.addTrack(localAudioTrack);

      pc.onicecandidate = async (e) => {
        if (e.candidate) {
          socket.emit("add-ice-candidate", {
            candidate: e.candidate,
            type: "sender",
            roomId,
          });
        }
      };

      pc.onnegotiationneeded = async () => {
        const sdp = await pc.createOffer();
        //@ts-ignore
        pc.setLocalDescription(sdp);
        socket.emit("offer", {
          sdp,
          roomId,
          name,
        });
      };
    });

    socket.on(
      "offer",
      async ({ roomId, sdp: remoteSdp, name: remoteUserName }) => {
        console.log("received offer");
        setLobby(false);
        setRemoteName(remoteUserName); // <--- store remote name

        const pc = new RTCPeerConnection();
        pc.setRemoteDescription(remoteSdp);

        const sdp = await pc.createAnswer();
        //@ts-ignore
        pc.setLocalDescription(sdp);

        const stream = new MediaStream();
        if (remoteVideoRef.current) {
          remoteVideoRef.current.srcObject = stream;
        }

        setRemoteMediaStream(stream);
        setReceivingPc(pc);
        window.pcr = pc;

        pc.onicecandidate = async (e) => {
          if (e.candidate) {
            socket.emit("add-ice-candidate", {
              candidate: e.candidate,
              type: "receiver",
              roomId,
            });
          }
        };

        socket.emit("answer", { roomId, sdp });

        const track1 = pc.getTransceivers()[0].receiver.track;
        const track2 = pc.getTransceivers()[1].receiver.track;
        console.log(track1);
        if (track1.kind === "video") {
          setRemoteAudioTrack(track2);
          setRemoteVideoTrack(track1);
        } else {
          setRemoteAudioTrack(track1);
          setRemoteVideoTrack(track2);
        }
        //@ts-ignore 
        remoteVideoRef.current.srcObject.addTrack(track1); 
        //@ts-ignore 
        remoteVideoRef.current.srcObject.addTrack(track2); 
        //@ts-ignore 
        remoteVideoRef.current.play();
      }
    );

    socket.on("answer", ({ sdp: remoteSdp }) => {
      setLobby(false);
      setSendingPc((pc) => {
        pc?.setRemoteDescription(remoteSdp);
        return pc;
      });
      console.log("loop closed");
    });

    socket.on("lobby", () => {
      setLobby(true);
    });

    socket.on("add-ice-candidate", ({ candidate, type }) => {
      console.log("add ice candidate from remote");
      console.log({ candidate, type });
      if (type == "sender") {
        setReceivingPc((pc) => {
          if (!pc) {
            console.error("receicng pc nout found");
          } else {
            console.error(pc.ontrack);
          }
          pc?.addIceCandidate(candidate);
          return pc;
        });
      } else {
        setSendingPc((pc) => {
          if (!pc) {
            console.error("sending pc nout found");
          } else {
            // console.error(pc.ontrack)
          }
          pc?.addIceCandidate(candidate);
          return pc;
        });
      }
    });
  }, [name]);

  useEffect(() => {
    if (localVideoRef.current) {
      if (localVideoTrack) {
        localVideoRef.current.srcObject = new MediaStream([localVideoTrack]);
        localVideoRef.current.play();
      }
    }
  }, [localVideoRef]);

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-100 to-gray-200 flex flex-col items-center justify-center p-4">
      <h2 className="text-2xl font-semibold mb-4 text-gray-700">Hi {name}</h2>

      <div className="flex flex-col md:flex-row gap-6 items-center justify-center w-full max-w-5xl">
        {/* Local Video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="relative w-80 h-60 md:w-96 md:h-72 rounded-xl overflow-hidden shadow-lg border-2 border-gray-300"
        >
          <video
            ref={localVideoRef}
            autoPlay
            muted
            className="w-full h-full object-cover"
          />
          <span className="absolute bottom-2 left-2 bg-indigo-600 text-white px-2 py-1 rounded text-sm">
            You
          </span>
        </motion.div>

        {/* Remote Video */}
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5, delay: 0.2 }}
          className="relative w-80 h-60 md:w-96 md:h-72 rounded-xl overflow-hidden shadow-lg border-2 border-gray-300"
        >
          <video
            ref={remoteVideoRef}
            autoPlay
            className="w-full h-full object-cover bg-black"
          />
          <span className="absolute bottom-2 left-2 bg-red-600 text-white px-2 py-1 rounded text-sm">
            {remoteName}
          </span>
        </motion.div>
      </div>

      {/* Lobby / Status */}
      {lobby && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.4 }}
          className="mt-6 text-gray-600 font-medium"
        >
          Waiting to connect you to someone...
        </motion.div>
      )}
    </div>
  );
};
