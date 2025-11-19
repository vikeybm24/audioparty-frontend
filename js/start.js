const socket = window.socket;

let localStream = null;
let listeners = {};
let roomCode = null;

const startBtn = document.getElementById("startBtn");
const closeBtn = document.getElementById("closeBtn");
const hostTypeEl = document.getElementById("hostType");
const playbackModeEl = document.getElementById("playbackMode");
const roomCodeBox = document.getElementById("roomCodeBox");
const roomCodeSpan = document.getElementById("roomCode");
const hostInfo = document.getElementById("hostInfo");

startBtn.onclick = () => {
  socket.emit("create-room");
};

socket.on("room-created", async (code) => {
  roomCode = code;
  roomCodeBox.style.display = "block";
  roomCodeSpan.textContent = code;
  closeBtn.style.display = "inline-block";

  const hostType = hostTypeEl.value; // 'pc' or 'mobile'
  hostInfo.textContent = `Host Type: ${hostType === 'pc' ? 'PC (system audio)' : 'Mobile (microphone)'} — Waiting for listeners...`;

  try {
    if (hostType === "pc") {
      // Desktop/PC: capture system audio via getDisplayMedia
      // Must use video:true so Chrome provides "Share system audio" checkbox
      localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
          echoCancellation: false,
          noiseSuppression: false,
          autoGainControl: false
        }
      });

      // we don't want video locally - stop video tracks
      localStream.getVideoTracks().forEach(t => t.stop());
    } else {
      // Mobile host (microphone only)
      // Use getUserMedia for microphone capture
      localStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      });

      // Optionally show a small local-preview muted element (not required)
      // const preview = new Audio();
      // preview.srcObject = localStream;
      // preview.muted = true;
      // preview.play().catch(()=>{});
    }

    // After stream is ready apply playback mode
    applyPlaybackMode();

    hostInfo.textContent += " — Stream active.";
  } catch (err) {
    console.error("Error obtaining media:", err);
    hostInfo.textContent = "Media permission error: " + (err.message || err);
    // optionally notify server to remove room if no media
  }
});

function applyPlaybackMode() {
  if (!localStream) return;

  const mode = playbackModeEl.value; // 'both' | 'mobile' | 'pc'

  if (mode === "pc") {
    // PC only: disable sending to mobile (we will still have local audio play)
    // We disable tracks so host will not send audio to listeners
    localStream.getAudioTracks().forEach(t => { t.enabled = false; });
    hostInfo.textContent = "Playback mode: PC-only (mobile will not receive audio).";
  } else if (mode === "mobile") {
    // Mobile only: send audio but mute local playback (if there is local playback)
    localStream.getAudioTracks().forEach(t => { t.enabled = true; });

    // Mute PC's local output (if any). We'll create a muted local audio element to attach the stream (to keep OS playing unaffected).
    // If you're on PC host and want local muted, this will silence local playback.
    try {
      const localAudio = new Audio();
      localAudio.srcObject = localStream;
      localAudio.muted = true;
      localAudio.play().catch(()=>{});
    } catch(e){ /* ignore */ }
    hostInfo.textContent = "Playback mode: Mobile-only (PC muted).";
  } else {
    // Both
    localStream.getAudioTracks().forEach(t => { t.enabled = true; });
    hostInfo.textContent = "Playback mode: Both PC + Mobile.";
  }
}

// When a listener joins, create a direct PeerConnection for that listener
socket.on("listener-joined", async (listenerId) => {
  console.log("New listener:", listenerId);

  if (!localStream) {
    // no stream ready - tell listener to wait or reject
    socket.emit("offer-error", { to: listenerId, message: "Host has no media." });
    return;
  }

  const pc = new RTCPeerConnection({
    iceServers: [{ urls: "stun:stun.l.google.com:19302" }]
  });

  // Send audio tracks to the listener
  localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

  pc.onicecandidate = (e) => {
    if (e.candidate) {
      socket.emit("ice-candidate", { to: listenerId, candidate: e.candidate });
    }
  };

  const offer = await pc.createOffer();
  await pc.setLocalDescription(offer);

  socket.emit("offer", { to: listenerId, offer });
  listeners[listenerId] = pc;
});

socket.on("answer", async ({ from, answer }) => {
  if (listeners[from]) {
    await listeners[from].setRemoteDescription(answer);
  }
});

socket.on("ice-candidate", ({ from, candidate }) => {
  if (listeners[from]) {
    listeners[from].addIceCandidate(candidate).catch(e => console.warn(e));
  }
});

// Close party / cleanup
closeBtn.onclick = () => {
  if (localStream) {
    localStream.getTracks().forEach(t => t.stop());
    localStream = null;
  }

  socket.emit("close-room", roomCode);

  // Close all peer connections
  Object.values(listeners).forEach(pc => {
    try { pc.close(); } catch(e) {}
  });
  listeners = {};

  alert("Party closed.");
  window.location.href = "index.html";
};
