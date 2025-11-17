const socket = window.socket;

let localStream;
let listeners = {};
let roomCode;

document.getElementById("startBtn").onclick = async () => {
    socket.emit("create-room");
};

socket.on("room-created", async (code) => {
    roomCode = code;

    document.getElementById("roomCodeBox").style.display = "block";
    document.getElementById("roomCode").textContent = code;
     document.getElementById("closeBtn").style.display = "inline-block";

    // Capture system audio
    localStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: {
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false
        }
    });

    // Remove video, keep only audio
    localStream.getVideoTracks().forEach(t => t.stop());
});


socket.on("listener-joined", async (listenerId) => {
    console.log("New listener:", listenerId);

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    // Send audio
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // ICE candidate → send to listener
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit("ice-candidate", {
                to: listenerId,
                candidate: e.candidate
            });
        }
    };

    // Create offer
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);

    socket.emit("offer", {
        to: listenerId,
        offer
    });

    listeners[listenerId] = pc;
});

// Listener sends answer
socket.on("answer", async ({ from, answer }) => {
    await listeners[from].setRemoteDescription(answer);
});

// Listener ICE candidate
socket.on("ice-candidate", ({ from, candidate }) => {
    listeners[from].addIceCandidate(candidate);
});

document.getElementById("closeBtn").onclick = () => {
    // Stop audio tracks
    localStream.getTracks().forEach(t => t.stop());

    // Notify server
    socket.emit("close-room", roomCode);

    alert("Party closed.");

    // Optional: redirect to home
    window.location.href = "index.html";
};
