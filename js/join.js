const socket = window.socket;

let pc;
let audioCtx = null;
let gainNode = null;
let source = null;

// Join the party
document.getElementById("joinBtn").onclick = () => {
    const code = document.getElementById("codeInput").value.trim();
    socket.emit("join-room", code);
};

// After join success
socket.on("join-success", () => {
    document.getElementById("status").textContent = "Connected!";
    document.getElementById("disconnectBtn").style.display = "inline-block";

    // Show mute button
    document.getElementById("muteMobile").style.display = "inline-block";
});

// Invalid code
socket.on("join-failed", () => {
    document.getElementById("status").textContent = "Invalid code!";
});

// Handle offer from host
socket.on("offer", async ({ from, offer }) => {

    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    // When host sends audio track
    pc.ontrack = (e) => {

        const audioElement = document.getElementById("audioPlayer");

        // Initialize AudioContext ONCE
        if (!audioCtx) {
            audioCtx = new AudioContext();
            source = audioCtx.createMediaStreamSource(e.streams[0]);
            gainNode = audioCtx.createGain();
        }

        // Volume boost (change 2.0 → 3.0/4.0 if needed)
        gainNode.gain.value = 2.0;

        // Connect boosted audio to destination
        source.connect(gainNode).connect(audioCtx.destination);

        // Set audio element source
        audioElement.srcObject = e.streams[0];

        // Try autoplay
        audioElement.play().catch(() => {
            // Autoplay blocked → show "Tap to Play" button
            document.getElementById("tapToPlay").style.display = "inline-block";
        });
    };

    // Forward host ICE candidates
    pc.onicecandidate = (e) => {
        if (e.candidate) {
            socket.emit("ice-candidate", { to: from, candidate: e.candidate });
        }
    };

    await pc.setRemoteDescription(offer);

    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);

    socket.emit("answer", { to: from, answer });
});

// Host ICE candidate received
socket.on("ice-candidate", ({ candidate }) => {
    pc.addIceCandidate(candidate);
});

// Host closes the room
socket.on("room-closed", () => {
    if (pc) pc.close();
    document.getElementById("audioPlayer").srcObject = null;

    alert("Host closed the party.");
    window.location.href = "index.html";
});

// Disconnect button
document.getElementById("disconnectBtn").onclick = () => {
    if (pc) {
        pc.close();
        pc = null;
    }
    document.getElementById("audioPlayer").srcObject = null;

    alert("Disconnected from party.");
    window.location.href = "index.html";
};

// ⭐⭐ MUTE / UNMUTE MOBILE ⭐⭐
document.getElementById("muteMobile").onclick = () => {
    const audio = document.getElementById("audioPlayer");
    audio.muted = !audio.muted;

    document.getElementById("muteMobile").textContent =
        audio.muted ? "Unmute Mobile" : "Mute Mobile";
};

// ⭐⭐ TAP TO PLAY (Fix mobile autoplay) ⭐⭐
document.getElementById("tapToPlay").onclick = () => {
    const audio = document.getElementById("audioPlayer");

    audio.play().then(() => {
        document.getElementById("tapToPlay").style.display = "none";
    }).catch(err => {
        alert("Still blocked: " + err);
    });
};
