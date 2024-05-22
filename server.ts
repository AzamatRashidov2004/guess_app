import * as net from "net";
import * as fs from 'fs';

const TCP_PORT = 12345;
const UNIX_SOCKET_PATH = '/tmp/guess_game_socket';
const PASSWORD = 'secret';

interface Client {
  socket: net.Socket;
  id: number;
}

interface Game {
  opponent: number;
  word: string;
  attempts: number;
}

let clients: { [key: number]: Client } = {};
let clientIdCounter = 1;
let games: { [key: number]: Game } = {};

enum MessageType {
  INITIATE = 'initiate',
  PASSWORD = 'password',
  ASSIGN_ID = 'assign_id',
  REQUEST_OPPONENTS = 'request_opponents',
  OPPONENT_LIST = 'opponent_list',
  REQUEST_MATCH = 'request_match',
  MATCH_RESPONSE = 'match_response',
  GUESS_WORD = 'guess_word',
  GUESS_RESPONSE = 'guess_response',
  HINT = 'hint',
  ERROR = 'error'
}

function sendMessage(socket: net.Socket, type: MessageType, payload: any) {
  const message = JSON.stringify({ type, payload });
  socket.write(message);
}

function handleClient(socket: net.Socket) {
  let clientId: number | null = null;

  socket.on('data', (data) => {
    const message = JSON.parse(data.toString());
    const { type, payload } = message;

    switch (type) {
      case MessageType.PASSWORD:
        if (payload === PASSWORD) {
          clientId = clientIdCounter++;
          clients[clientId] = { socket, id: clientId };
          sendMessage(socket, MessageType.ASSIGN_ID, clientId);
        } else {
          sendMessage(socket, MessageType.ERROR, 'Wrong password.');
          socket.end();
        }
        break;
      
      case MessageType.REQUEST_OPPONENTS:
        if (clientId !== null) {
          const opponentList = Object.keys(clients).map(Number).filter(id => id !== clientId);
          sendMessage(socket, MessageType.OPPONENT_LIST, opponentList);
        }
        break;
      
      case MessageType.REQUEST_MATCH:
        if (clientId !== null) {
          const { opponentId, word } = payload;
          if (clients[opponentId]) {
            games[clientId] = { opponent: opponentId, word, attempts: 0 };
            sendMessage(clients[opponentId].socket, MessageType.MATCH_RESPONSE, { clientId, word });
            sendMessage(socket, MessageType.MATCH_RESPONSE, { opponentId });
          } else {
            sendMessage(socket, MessageType.ERROR, 'Opponent not available.');
          }
        }
        break;

      case MessageType.GUESS_WORD:
        if (clientId !== null) {
          const { opponentId, guess } = payload;
          const game = games[opponentId];
          if (game && game.word === guess) {
            sendMessage(socket, MessageType.GUESS_RESPONSE, 'Correct!');
            sendMessage(clients[opponentId].socket, MessageType.GUESS_RESPONSE, 'Correct!');
            delete games[opponentId];
          } else {
            game.attempts += 1;
            sendMessage(socket, MessageType.GUESS_RESPONSE, 'Incorrect.');
            sendMessage(clients[opponentId].socket, MessageType.GUESS_RESPONSE, game.attempts);
          }
        }
        break;

      case MessageType.HINT:
        if (clientId !== null) {
          const { opponentId, hint } = payload;
          sendMessage(clients[opponentId].socket, MessageType.HINT, hint);
        }
        break;

      default:
        sendMessage(socket, MessageType.ERROR, 'Unknown message type.');
        break;
    }
  });

  socket.on('end', () => {
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

  const tcpServer = net.createServer(handleClient);
  tcpServer.listen(TCP_PORT, () => {
    console.log(`Server running on TCP port ${TCP_PORT}`);
  });

  const unixServer = net.createServer(handleClient);
  unixServer.listen(UNIX_SOCKET_PATH, () => {
    console.log(`Server running on Unix socket ${UNIX_SOCKET_PATH}`);
  });
}

startServer();