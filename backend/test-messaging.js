import { io } from "socket.io-client";

const {
  USER_A_TOKEN,
  USER_B_TOKEN,
  CONVERSATION_ID,
} = process.env;

if (!USER_A_TOKEN || !USER_B_TOKEN || !CONVERSATION_ID) {
  console.error(
    "Set USER_A_TOKEN, USER_B_TOKEN, and CONVERSATION_ID first."
  );
  process.exit(1);
}

const userA = io("http://localhost:5000", {
  auth: { token: USER_A_TOKEN },
  reconnection: false,
});

const userB = io("http://localhost:5000", {
  auth: { token: USER_B_TOKEN },
  reconnection: false,
});

let sent = false;
let received = false;

function fail(message) {
  console.error(message);
  userA.disconnect();
  userB.disconnect();
  process.exitCode = 1;
}

userA.on("connect_error", (error) => {
  fail(`User A connection failed: ${error.message}`);
});

userB.on("connect_error", (error) => {
  fail(`User B connection failed: ${error.message}`);
});

userB.on("message:new", (message) => {
  if (message.text === "Hello through Socket.IO!") {
    received = true;
    console.log("User B received:", message.text);
    console.log("Saved message ID:", message._id);
    finishIfComplete();
  }
});

function finishIfComplete() {
  if (sent && received) {
    console.log("PASS: Message saved and delivered in real time.");
    userA.disconnect();
    userB.disconnect();
  }
}

function sendTestMessage() {
  if (!userA.connected || !userB.connected || sent) return;

  sent = true;

  userA.timeout(5000).emit(
    "message:send",
    {
      conversationId: CONVERSATION_ID,
      text: "Hello through Socket.IO!",
    },
    (error, response) => {
      if (error) {
        return fail("Message acknowledgement timed out.");
      }

      if (!response?.success) {
        return fail(
          `Message rejected: ${response?.message || "Unknown error"}`
        );
      }

      console.log("User A: Message saved successfully.");
      console.log("Message ID:", response.message._id);
      finishIfComplete();
    }
  );
}

userA.on("connect", sendTestMessage);
userB.on("connect", sendTestMessage);
