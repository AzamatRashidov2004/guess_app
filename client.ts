import * as net from "net";
import * as readline from "readline";

const TCP_HOST = "127.0.0.1";
const TCP_PORT = 12345;
const UNIX_SOCKET_PATH = "/tmp/guess_game_socket";

enum MessageType {
  INITIATE = "initiate",
  PASSWORD = "password",
  ASSIGN_ID = "assign_id",
  REQUEST_OPPONENTS = "request_opponents",
  OPPONENT_LIST = "opponent_list",
  REQUEST_MATCH = "request_match",
  MATCH_RESPONSE = "match_response",
  GUESS_WORD = "guess_word",
  GUESS_RESPONSE = "guess_response",
  HINT = "hint",
  ERROR = "error",
}

interface Message {
  type: MessageType;
  payload: any;
}

let matchEstablished = false;
let isGuessingPlayer = false;
let opponentId: number | null = null;

function sendMessage(socket: net.Socket, type: MessageType, payload: any) {
  const message = JSON.stringify({ type, payload });
  socket.write(message);
}

function handleServerMessage(socket: net.Socket) {
  const rl = readline.createInterface({
    input: process.stdin,
    terminal: true,
    historySize: 0,
  });
  rl.setPrompt("");
  rl.pause();

  socket.on("data", (data) => {
    const message: Message = JSON.parse(data.toString());
    const { type, payload } = message;

    switch (type) {
      case MessageType.INITIATE:
        console.log(payload);
        rl.resume();
        console.log("Password: ");
        rl.question("", (password) => {
          sendMessage(socket, MessageType.PASSWORD, password);
          rl.pause();
        });
        break;

      case MessageType.ASSIGN_ID:
        console.log(`Assigned client ID: ${payload}`);
        showMenu(socket, rl);
        break;

      case MessageType.OPPONENT_LIST:
        console.log("Available opponents:", payload);
        showMenu(socket, rl);
        break;

      case MessageType.MATCH_RESPONSE:
        console.log("Match response received.");
        matchEstablished = true;
        opponentId =
          payload.clientId !== undefined
            ? payload.clientId
            : payload.opponentId;
        isGuessingPlayer = payload.clientId !== undefined;
        showMenu(socket, rl);
        break;

      case MessageType.GUESS_RESPONSE:
        if (payload === "Incorrect." || payload === "Correct!") {
          console.log(payload);
        } else console.log("Guess count: ", payload);
        showMenu(socket, rl);
        break;

      case MessageType.HINT:
        console.log("Hint from opponent:", payload);
        showMenu(socket, rl);
        break;

      case MessageType.ERROR:
        console.log("Error:", payload);
        showMenu(socket, rl);
        break;

      default:
        console.log("Unknown message type.");
        showMenu(socket, rl);
        break;
    }
  });

  socket.on("end", () => {
    rl.close();
    console.log("Disconnected from server.");
  });
}

function showMenu(socket: net.Socket, rl: readline.Interface) {
  console.log("\nMenu:");
  if (!matchEstablished) {
    console.log("1. Request opponent list");
    console.log("2. Request match");
  } else {
    if (isGuessingPlayer) {
      console.log("3. Send guess");
    } else {
      console.log("4. Send hint");
    }
  }
  console.log("5. Exit");
  rl.setPrompt("");
  rl.resume();
  console.log("Enter your choice: ");
  rl.question("Enter your choice: ", (choice) => {
    switch (choice) {
      case "1":
        if (!matchEstablished)
          sendMessage(socket, MessageType.REQUEST_OPPONENTS, {});
        else invalidChoice();
        break;

      case "2":
        if (!matchEstablished) {
          rl.setPrompt("");
          rl.resume();
          console.log("Enter opponent ID: ");
          rl.question("Enter opponent ID: ", (opponentIdInput) => {
            opponentId = Number(opponentIdInput);
            console.log("Enter word to guess: ");
            rl.question("Enter word to guess: ", (word) => {
              sendMessage(socket, MessageType.REQUEST_MATCH, {
                opponentId,
                word,
              });
              rl.pause();
            });
          });
        } else invalidChoice();
        break;

      case "3":
        if (matchEstablished && isGuessingPlayer) {
          rl.setPrompt("");
          rl.resume();
          console.log("Enter your guess: ");
          rl.question("Enter your guess: ", (guess) => {
            sendMessage(socket, MessageType.GUESS_WORD, { opponentId, guess });
            rl.pause();
          });
        } else invalidChoice();
        break;

      case "4":
        if (matchEstablished && !isGuessingPlayer) {
          rl.setPrompt("");
          rl.resume();
          console.log("Enter hint: ");
          rl.question("Enter hint: ", (hint) => {
            sendMessage(socket, MessageType.HINT, { opponentId, hint });
            rl.pause();
          });
        } else invalidChoice();
        break;

      case "5":
        socket.end();
        rl.close();
        break;

      default:
        invalidChoice();
        break;
    }
  });

  function invalidChoice() {
    console.log("Invalid choice. Try again.");
    showMenu(socket, rl);
  }
}

function connectToServer(useTcp: boolean) {
  const socket = useTcp
    ? net.createConnection({ host: TCP_HOST, port: TCP_PORT })
    : net.createConnection(UNIX_SOCKET_PATH);
  handleServerMessage(socket);
}

function main() {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  rl.question("Connect via TCP (yes) or Unix socket (no)? ", (answer) => {
    const useTcp = answer.trim().toLowerCase() === "yes";
    connectToServer(useTcp);
    rl.close();
  });
}

main();
