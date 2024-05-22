"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var net = require("net");
var readline = require("readline");
var TCP_HOST = "127.0.0.1";
var TCP_PORT = 12345;
var UNIX_SOCKET_PATH = "/tmp/guess_game_socket";
var MessageType;
(function (MessageType) {
    MessageType["INITIATE"] = "initiate";
    MessageType["PASSWORD"] = "password";
    MessageType["ASSIGN_ID"] = "assign_id";
    MessageType["REQUEST_OPPONENTS"] = "request_opponents";
    MessageType["OPPONENT_LIST"] = "opponent_list";
    MessageType["REQUEST_MATCH"] = "request_match";
    MessageType["MATCH_RESPONSE"] = "match_response";
    MessageType["GUESS_WORD"] = "guess_word";
    MessageType["GUESS_RESPONSE"] = "guess_response";
    MessageType["HINT"] = "hint";
    MessageType["ERROR"] = "error";
})(MessageType || (MessageType = {}));
var matchEstablished = false;
var isGuessingPlayer = false;
var opponentId = null;
function sendMessage(socket, type, payload) {
    var message = JSON.stringify({ type: type, payload: payload });
    socket.write(message);
}
function handleServerMessage(socket) {
    var rl = readline.createInterface({
        input: process.stdin,
        terminal: true,
        historySize: 0,
    });
    rl.setPrompt("");
    rl.pause();
    socket.on("data", function (data) {
        var message = JSON.parse(data.toString());
        var type = message.type, payload = message.payload;
        switch (type) {
            case MessageType.INITIATE:
                console.log(payload);
                rl.resume();
                console.log("Password: ");
                rl.question("", function (password) {
                    sendMessage(socket, MessageType.PASSWORD, password);
                    rl.pause();
                });
                break;
            case MessageType.ASSIGN_ID:
                console.log("Assigned client ID: ".concat(payload));
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
                }
                else
                    console.log("Guess count: ", payload);
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
    socket.on("end", function () {
        rl.close();
        console.log("Disconnected from server.");
    });
}
function showMenu(socket, rl) {
    console.log("\nMenu:");
    if (!matchEstablished) {
        console.log("1. Request opponent list");
        console.log("2. Request match");
    }
    else {
        if (isGuessingPlayer) {
            console.log("3. Send guess");
        }
        else {
            console.log("4. Send hint");
        }
    }
    console.log("5. Exit");
    rl.setPrompt("");
    rl.resume();
    console.log("Enter your choice: ");
    rl.question("Enter your choice: ", function (choice) {
        switch (choice) {
            case "1":
                if (!matchEstablished)
                    sendMessage(socket, MessageType.REQUEST_OPPONENTS, {});
                else
                    invalidChoice();
                break;
            case "2":
                if (!matchEstablished) {
                    rl.setPrompt("");
                    rl.resume();
                    console.log("Enter opponent ID: ");
                    rl.question("Enter opponent ID: ", function (opponentIdInput) {
                        opponentId = Number(opponentIdInput);
                        console.log("Enter word to guess: ");
                        rl.question("Enter word to guess: ", function (word) {
                            sendMessage(socket, MessageType.REQUEST_MATCH, {
                                opponentId: opponentId,
                                word: word,
                            });
                            rl.pause();
                        });
                    });
                }
                else
                    invalidChoice();
                break;
            case "3":
                if (matchEstablished && isGuessingPlayer) {
                    rl.setPrompt("");
                    rl.resume();
                    console.log("Enter your guess: ");
                    rl.question("Enter your guess: ", function (guess) {
                        sendMessage(socket, MessageType.GUESS_WORD, { opponentId: opponentId, guess: guess });
                        rl.pause();
                    });
                }
                else
                    invalidChoice();
                break;
            case "4":
                if (matchEstablished && !isGuessingPlayer) {
                    rl.setPrompt("");
                    rl.resume();
                    console.log("Enter hint: ");
                    rl.question("Enter hint: ", function (hint) {
                        sendMessage(socket, MessageType.HINT, { opponentId: opponentId, hint: hint });
                        rl.pause();
                    });
                }
                else
                    invalidChoice();
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
function connectToServer(useTcp) {
    var socket = useTcp
        ? net.createConnection({ host: TCP_HOST, port: TCP_PORT })
        : net.createConnection(UNIX_SOCKET_PATH);
    handleServerMessage(socket);
}
function main() {
    var rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
    });
    rl.question("Connect via TCP (yes) or Unix socket (no)? ", function (answer) {
        var useTcp = answer.trim().toLowerCase() === "yes";
        connectToServer(useTcp);
        rl.close();
    });
}
main();
