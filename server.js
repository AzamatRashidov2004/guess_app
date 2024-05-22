"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
var net = require("net");
var fs = require("fs");
var TCP_PORT = 12345;
var UNIX_SOCKET_PATH = '/tmp/guess_game_socket';
var PASSWORD = 'secret';
var clients = {};
var clientIdCounter = 1;
var games = {};
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
function sendMessage(socket, type, payload) {
    var message = JSON.stringify({ type: type, payload: payload });
    socket.write(message);
}
function handleClient(socket) {
    var clientId = null;
    socket.on('data', function (data) {
        var message = JSON.parse(data.toString());
        var type = message.type, payload = message.payload;
        switch (type) {
            case MessageType.PASSWORD:
                if (payload === PASSWORD) {
                    clientId = clientIdCounter++;
                    clients[clientId] = { socket: socket, id: clientId };
                    sendMessage(socket, MessageType.ASSIGN_ID, clientId);
                }
                else {
                    sendMessage(socket, MessageType.ERROR, 'Wrong password.');
                    socket.end();
                }
                break;
            case MessageType.REQUEST_OPPONENTS:
                if (clientId !== null) {
                    var opponentList = Object.keys(clients).map(Number).filter(function (id) { return id !== clientId; });
                    sendMessage(socket, MessageType.OPPONENT_LIST, opponentList);
                }
                break;
            case MessageType.REQUEST_MATCH:
                if (clientId !== null) {
                    var opponentId = payload.opponentId, word = payload.word;
                    if (clients[opponentId]) {
                        games[clientId] = { opponent: opponentId, word: word, attempts: 0 };
                        sendMessage(clients[opponentId].socket, MessageType.MATCH_RESPONSE, { clientId: clientId, word: word });
                        sendMessage(socket, MessageType.MATCH_RESPONSE, { opponentId: opponentId });
                    }
                    else {
                        sendMessage(socket, MessageType.ERROR, 'Opponent not available.');
                    }
                }
                break;
            case MessageType.GUESS_WORD:
                if (clientId !== null) {
                    var opponentId = payload.opponentId, guess = payload.guess;
                    var game = games[opponentId];
                    if (game && game.word === guess) {
                        sendMessage(socket, MessageType.GUESS_RESPONSE, 'Correct!');
                        sendMessage(clients[opponentId].socket, MessageType.GUESS_RESPONSE, 'Correct!');
                        delete games[opponentId];
                    }
                    else {
                        game.attempts += 1;
                        sendMessage(socket, MessageType.GUESS_RESPONSE, 'Incorrect.');
                        sendMessage(clients[opponentId].socket, MessageType.GUESS_RESPONSE, game.attempts);
                    }
                }
                break;
            case MessageType.HINT:
                if (clientId !== null) {
                    var opponentId = payload.opponentId, hint = payload.hint;
                    sendMessage(clients[opponentId].socket, MessageType.HINT, hint);
                }
                break;
            default:
                sendMessage(socket, MessageType.ERROR, 'Unknown message type.');
                break;
        }
    });
    socket.on('end', function () {
        if (clientId !== null) {
            delete clients[clientId];
        }
    });
    sendMessage(socket, MessageType.INITIATE, 'Welcome! Please send the password.');
}
function startServer() {
    if (fs.existsSync(UNIX_SOCKET_PATH)) {
        fs.unlinkSync(UNIX_SOCKET_PATH);
    }
    var tcpServer = net.createServer(handleClient);
    tcpServer.listen(TCP_PORT, function () {
        console.log("Server running on TCP port ".concat(TCP_PORT));
    });
    var unixServer = net.createServer(handleClient);
    unixServer.listen(UNIX_SOCKET_PATH, function () {
        console.log("Server running on Unix socket ".concat(UNIX_SOCKET_PATH));
    });
}
startServer();
