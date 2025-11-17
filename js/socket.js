// CHANGE THIS TO YOUR BACKEND URL:
window.SIGNALING_SERVER = "https://audioparty-backend.onrender.com";

window.socket = io(window.SIGNALING_SERVER, {
    transports: ["websocket"]
});
