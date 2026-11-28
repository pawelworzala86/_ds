import * as httpTypes from './system/http.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import http from './system/http.ts'

const hostname = '127.0.0.1';
const port = 3000;

function listenCallback(){
  console.log('Serwer działa');
};

function requestCallback(req: httpTypes.IncomingMessage, res: httpTypes.ServerResponse){
  msvcrt.printf('trace: callback start\n')
  msvcrt.fflush(0)
  //res.statusCode = 200;
  //res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end('hello world\n');
  msvcrt.printf('trace: callback end\n')
  msvcrt.fflush(0)
}

const server = http.createServer(requestCallback);

server.listen(port, hostname, listenCallback);