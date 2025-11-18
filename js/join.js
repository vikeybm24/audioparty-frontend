const socket = window.socket;

let pc;
let audioCtx = null;      // needed for mute/unmute
let gainNode = null;      // needed for volume control
let source = null;

document.getElementById("joinBtn").onclick = () => {
    const code = document.getElementById("codeInput").value.trim();
    socket.emit("join-room", code);
};

socket.on("join-success", () => {
    document.getElementById("status").textContent = "Connected!";
    document.getElementById("disconnectBtn").style.display = "inline-block";

    // show mute button after connected
    document.getElementById("muteMobile").style.display = "inline-block";
});

socket.on("join-failed", () => {
    document.getElementById("status").textContent = "Invalid code!";
});

socket.on("offer", async ({ from, offer }) => {

    pc = new RTCPeerConnection({
        iceServers: [
            { urls: "stun:stun.l.google.com:19302" }
        ]
    });

    pc.ontrack = (e) => {

        // SETUP AudioContext only once
        if (!audioCtx) {
            audioCtx = new AudioContext();
            source = audioCtx.createMediaStreamSource(e.streams[0]);
            gainNode = audioCtx.createGain();
        }

        // Volume boost
        gainNode.gain.value = 2.0; 

        source.connect(gainNode).connect(audioCtx.destination);

        document.getElementById("audioPlayer").srcObject = e.streams[0];
    };

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

socket.on("ice-candidate", ({ candidate }) => {
    pc.addIceCandidate(candidate);
});

socket.on("room-closed", () => {
    if (pc) pc.close();

    document.getElementById("audioPlayer").srcObject = null;

    alert("Host closed the party.");
    window.location.href = "index.html";
});

document.getElementById("disconnectBtn").onclick = () => {
    if (pc) {
        pc.close();
        pc = null;
    }

    document.getElementById("audioPlayer").srcObject = null;

    alert("Disconnected from party.");
    window.location.href = "index.html";
};

// ⭐⭐ MUTE / UNMUTE BUTTON ⭐⭐
document.getElementById("muteMobile").onclick = () => {
    const audio = document.getElementById("audioPlayer");
    audio.muted = !audio.muted;

    // update button text
    document.getElementById("muteMobile").textContent =
        audio.muted ? "Unmute Mobile" : "Mute Mobile";
};
