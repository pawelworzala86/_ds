import * as httpTypes from './system/http.ts'
import * as msvcrt from './system/lib/msvcrt.ts'
import http from './system/http.ts'

const hostname = '127.0.0.1';
const port = 3000;

function listenCallback(){
  console.log('Serwer działa');
};

function requestCallback(req: httpTypes.Request, res: httpTypes.Response){
  msvcrt.printf('trace: callback start\n')
  msvcrt.fflush(0)
  console.log('URL: ' + req.url)
  if (req.isGet()) {
    res.json({method: 'GET'})
  } else if (req.isPost()) {
    res.json({method: 'POST'})
  } else if (req.isPut()) {
    res.json({method: 'PUT'})
  } else if (req.isPatch()) {
    res.json({method: 'PATCH'})
  } else if (req.isDelete()) {
    res.json({method: 'DELETE'})
  } else {
    res.statusCode = 405
    res.json({error:"Method Not Allowed"})
  }
  msvcrt.printf('trace: callback end\n')
  msvcrt.fflush(0)
}

const server = http.createServer(requestCallback);

server.listen(port, hostname, listenCallback);