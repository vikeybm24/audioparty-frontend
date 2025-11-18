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

    // Remove video track
    localStream.getVideoTracks().forEach(t => t.stop());

    // APPLY PLAYBACK MODE HERE (correct place)
    applyPlaybackMode();
});

function applyPlaybackMode() {
    const mode = document.getElementById("playbackMode").value;

    if (!localStream) return;

    if (mode === "pc") {
        // PC only : don't send audio to mobile
        localStream.getAudioTracks().forEach(t => t.enabled = false);
        console.log("Mode: PC only. Audio will NOT go to mobile.");
    }

    else if (mode === "mobile") {
        // Mobile only : send audio to mobile but mute local output
        localStream.getAudioTracks().forEach(t => t.enabled = true);

        const audioEl = new Audio();
        audioEl.srcObject = localStream;
        audioEl.muted = true; // Mute on PC
        audioEl.play();

        console.log("Mode: Mobile only.");
    }

    else {
        // both
        localStream.getAudioTracks().forEach(t => t.enabled = true);
        console.log("Mode: Both PC + Mobile");
    }
}

// Listener joined
socket.on("listener-joined", async (listenerId) => {
    console.log("New listener:", listenerId);

    const pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    // Send audio
    localStream.getTracks().forEach(track => pc.addTrack(track, localStream));

    // ICE Candidate
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

// listener answer
socket.on("answer", async ({ from, answer }) => {
    await listeners[from].setRemoteDescription(answer);
});

socket.on("ice-candidate", ({ from, candidate }) => {
    listeners[from].addIceCandidate(candidate);
});

// close party
document.getElementById("closeBtn").onclick = () => {
    localStream.getTracks().forEach(t => t.stop());

    socket.emit("close-room", roomCode);

    alert("Party closed.");
    window.location.href = "index.html";
};
