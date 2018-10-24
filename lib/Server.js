const fs = require('fs');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');
const parse = require('querystring').parse;
const EventEmitter = require('events').EventEmitter;

var Database = require('./Database')
var PubSub = require('./PubSub')
var helpers = require('./helpers')

class DbServer extends EventEmitter {

    constructor(port, host){
        super();
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222
        this.db = {}
        this._pubsub = new PubSub()
        this._query = {}
        this._param
        this._path
    }

    listen(callback){
        callback = (typeof callback === 'function') ? callback : function(){}
        const server = this.handler_http();
        this._wss =  new WebSocket.Server( { server } );
        this._server = server
        this._server.listen(this._port, this._host, function(){
            callback()
        })
        this.handler_wss()
    }

    handler_http(){
        let self = this

        return new http.createServer( (req, res) => {

            self._query = url.parse(req.url, true)
            self._path = self.parseParam(self._query.pathname)

            switch(req.method){
                case 'GET':
                self.handler_req_res(self._path[0], self._path[1], self._query.query, res)
                break
                case 'POST':
                self.createDataFromReq(req, function(body){
                    self.handler_req_res(self._path[0], self._path[1], body, res) 
                })
                break
                case 'PUT':
                self.createDataFromReq(req, function(body){
                    self.handler_req_res(self._path[0], self._path[1], body, res)  
                })
                break
                case 'DELETE':
                self.createDataFromReq(req, function(body){
                    self.handler_req_res(self._path[0], self._path[1], body, res)    
                })
                break
                default:
                res.writeHead(500, {'Content-Type': 'application/json'});
                res.write(Buffer.from(JSON.stringify({ error : 'method error'})));
                res.end();
                break
            }
        });
    }

    handler_req_res(db, meta, data, res){
        this.database(this.buildData(db, meta, data), function(docs){
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write(Buffer.from(JSON.stringify(docs)));
            res.end();
        })
    }

    /** 
     *handle the websocket data
    */
    handler_wss(){
        let self = this
        this._wss.on('connection', function connection(ws, req) {
            ws.on('message', function incoming(data) {
                try {
                    data = JSON.parse(data.toString())
                    //the db name is defined in the url path
                    data.db = '.' + req.url
                    // handle the database
                    self.database(data, function(docs){
                        ws.send(Buffer.from(JSON.stringify(docs)))
                    })
                    //handle the publish and subscribe-part
                    self._pubsub.handle(self.convertMeta(data.meta), data.data, ws)
                }
                catch(e){
                    ws.send(Buffer.from(JSON.stringify({ err : 'data-format is not JSON', data : null})))
                }
            })
            ws.on('close', function disconnect(ws){
                self._pubsub.handle('destroy', '', ws)
            })
            ws.on('error', function(){
                self._pubsub.handle('destroy', '', ws)
            })
        });
    }

    /** 
     * Convert the db-metas to the pubsub specific names
    */
    convertMeta(meta){
        let m = meta
        if(meta === 'put' || meta === 'update'){
            m = 'publish'
        }
        else if(meta === 'del'){
            m = 'unsubscribe'
        }
        return m
    }

    parseParam(path){
        return (path.length < 2 ) ? null : path.slice(1,path.length).split('/')
    }

    buildData(db, meta, data){
        return {
            db: db,
            meta : meta,
            data: data
        }
    }

    createDataFromReq(request, callback){
        var buffer = new Buffer('');
        request.on('data', chunk => {
            buffer = Buffer.concat([buffer, chunk]);
        });
        request.on('end', () => {
            try{
                callback(JSON.parse(buffer.toString()));
            }
            catch(e){
                callback(null)
            }
        });
    }

    /**
     * Handle the database
     * @param {socket} socket 
     * @param {object} data 
     */
    database(data, callback){
        let self = this
        if(data.meta !== 'subscribe' && data.meta !== 'unsubscribe'){
            if(!(this.db[data.db] instanceof Database)){
                this.db[data.db] = new Database(data.db)
            }
            this.db[data.db].handler(data.meta, data.data, function(docs){
                callback(docs)
            }) 
        }
    }
}



module.exports = DbServer
