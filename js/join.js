const socket = window.socket;

let pc;

document.getElementById("joinBtn").onclick = () => {
    const code = document.getElementById("codeInput").value.trim();
    socket.emit("join-room", code);
};

socket.on("join-success", () => {
    document.getElementById("status").textContent = "Connected!";
    document.getElementById("disconnectBtn").style.display = "inline-block";
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
