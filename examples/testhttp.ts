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
  const testHeader:string = req.getHeader('X-Test-Header')
  console.log(testHeader)
  res.setHeader('X-Test-Response', 'response-value')
  res.setHeader('X-Echo-Header', testHeader)

  
  console.log('GET query:', req.query)
  console.log('Query user:', req.query.user)
  console.log('Query repeated values:', req.query.tag)
  console.log('Request body:', req.body)
  console.log('Request body is JSON:', req.bodyIsJSON)
  if (req.bodyIsJSON) {
    const name:string = req.body.profile.name
    console.log('JSON body name:', name)
    console.log('JSON body array:', req.body.profile.values[0])
  }

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