var express = require("express");
var app = express();

if( process.argv.length < 3 ) {
  console.log(
    'Usage: \n' +
    'node stream-server.js <secret> [<stream-port> <websocket-port>]'
  );
  process.exit();
}

var STREAM_SECRET = process.argv[2],
  STREAM_PORT = process.argv[3] || 8082,
  WEBSOCKET_PORT = process.argv[4] || 8084,
  STREAM_MAGIC_BYTES = 'jsmp'; // Must be 4 bytes

var width = 320,
  height = 240;

// Websocket Server
var socketServer = new (require('ws').Server)({port: WEBSOCKET_PORT});
socketServer.on('connection', function(socket) {
  // Send magic bytes and video size to the newly connected socket
  // struct { char magic[4]; unsigned short width, height;}
  var streamHeader = new Buffer(8);
  streamHeader.write(STREAM_MAGIC_BYTES);
  streamHeader.writeUInt16BE(width, 4);
  streamHeader.writeUInt16BE(height, 6);
  socket.send(streamHeader, {binary:true});

  console.log( 'New WebSocket Connection ('+socketServer.clients.length+' total)' );
  
  socket.on('close', function(code, message){
    console.log( 'Disconnected WebSocket ('+socketServer.clients.length+' total)' );
  });
});

socketServer.broadcast = function(data, opts) {
  for( var i in this.clients ) {
    if (this.clients[i].readyState == 1) {
      this.clients[i].send(data, opts);
    }
    else {
      console.log( 'Error: Client ('+i+') not connected.' );
    }
  }
};

var
  fs = require('fs'),
  Mixer = require('../index.js'),
  wav = require('wav')
  ;

/*
 * Create the mixer and stream to speaker:
 */

var mixer = new Mixer({
  channels: 1
});

/*var speaker = new Speaker({
  channels: 1,
  bitDepth: 16,
  sampleRate: 44100
});*/

//mixer.pipe(speaker);


var file2 = fs.createReadStream('test2.wav');
var reader = new wav.Reader();

// the "format" event gets emitted at the end of the WAVE header
reader.on('format', function (format) {
  console.log(format);
  // the WAVE header is stripped from the output of the reader
  reader.pipe(mixer.input({
    sampleRate: format.sampleRate,
    channels: format.channels,
    bitDepth: format.bitDepth
  }));
});

file2.pipe(reader);

mixer.on('data', function(chunk) {
  console.log('got %d bytes of data', chunk.length);
  socketServer.broadcast(chunk, {binary:true});
});


console.log('Awaiting WebSocket connections on ws://127.0.0.1:'+WEBSOCKET_PORT+'/');

app.get("/", function(req, res) {
  res.send('WorldSong International v0.1');
});

app.post("/upload", function(req, res) {
  res.send('Got a POST request');
});
