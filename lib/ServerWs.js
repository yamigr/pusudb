/** 
 * Autor: yannick grund, 2018
 * This class implements the websocket-server to the pusudb
 * It shares the same port like the http-server
 * Over websocket it's possible to handle the normal queries for the database
 * But it's also possible to publish or subscribe the data. When someone put or update a certain entry, all subscribed sockets receives the data.
 * Wildcards are supported by #
*/

const WebSocket = require('ws');
const helpers = require('./helpers')
const async = require('async')
const debug = require('debug')('pusudb:ws')
const debugPingPong = require('debug')('pusudb:ws_pingpong')

const Utility = require('./Utility')

class WsServer extends Utility {

    constructor(host, pubsub, opt){
        super(opt, host, pubsub)
        this.options = typeof opt === 'object' ? opt : {}
        this.pubsub = pubsub
    }

    /**
     * websocket connection
     * @param {object} server http server instance
     */
    attachToHttp(server){
        debug('listen, attached to http-server')
        this._wss =  new WebSocket.Server( { server : server } );
        this._wss.on('connection', this.middleware.bind(this));
        if(this.options.heartbeat > 0)
        this.ping()
    }

    /**
     * websocket connection
     * @param {object} cfg configuration
     */
    attachSelf(cfg){
        debug('listen', cfg.port, cfg.host)
        this._wss =  new WebSocket.Server( { host : cfg.host, port : parseInt(cfg.port) } );
        this._wss.on('connection', this.middleware.bind(this));
    }


    /**
     * This method will be called when a socket is connecting
     * @param {object} ws 
     * @param {object} req 
     */
    middleware(ws, req){
        let self = this

        //prepare the req variables
        this.defineRequestProps(req, false)
        if(this.options.heartbeat > 0)
        this.pong(ws)
        
        try{
            // Handle middleware while connection established
            helpers.asyncMiddleware(this, this.sequenceConnection, req, ws, function(err, req, ws){
                // if error, send error, or handle the message
                if(err){
                    self.socketSend(ws, { err : err.toString(), data : null })  
                }
                else{
                    self.handleRequestAndSendTheData(req, ws)
                }
            })
        }
        catch(e){
            console.error(e)
        }
    }

    ping(){
        let self = this
        setInterval(function ping() {
            debugPingPong('ping, interval: %oms, clients: %o', self.options.heartbeat, self._wss.clients.size)
            self._wss.clients.forEach(function each(ws) {
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping(function(){ /* Noob */ });
            });
        }, this.options.heartbeat);
    }

    pong(ws){
        ws.isAlive = true;
        ws.on('pong', this.heartbeat.bind(ws));
    }

    heartbeat() {
        debugPingPong('pong')
        this.isAlive = true;
    }
        
    /**
     * Final function to get the data and handle the response
     * @param {object} req 
     * @param {object} ws 
     */
    handleRequestAndSendTheData(req, ws){
        let self = this
        
        ws.on('message', function incoming(data) {

            async.series([
                function(next){
                    try{
                        // parse the data to json
                        req.body  = JSON.parse(data.toString())
                        next()
                    }catch(e){
                        next(e.toString())
                    }
                },
                function(next){
                    // Handle middleware before querying
                    helpers.asyncMiddleware(self, self.sequenceBefore, req, ws, function(err, req, ws){
                        next(err) 
                    })
                },
                function(next){
                    // Database
                    if(self.enableQueryDb(req.url, req.body)) {
                        self.handlerQueryAndPubSub(req.body, req, ws, function(docs){
                            req.docs = Object.assign(req.docs, req.body, docs)
                            next()
                        })
                    }
                    else{
                        next()
                    }
                },
                function(next){
                    // Handle middleware after querying
                    helpers.asyncMiddleware(self, self.sequence, req, ws, function(err, req, ws){
                        next(err) 
                    })
                }
            ], function(err){
                if(err){
                    req.docs = { err : err, data : null}
                }
                self.socketSend(ws, req.docs)
                debug('db: %o, meta: %o, err: %o', req.docs.db, req.docs.meta, req.docs.err)
            })
        })
        
        ws.on('close', function disconnect(){
            debug('close')
            self.pubsub.handle( 'destroy', '', ws)
        })
        ws.on('error', function(){
            debug('error')
            self.pubsub.handle( 'destroy', '', ws)
        })
    }

    /**
     * Sending 
     * @param {object} ws 
     * @param {object} data { err: '', data : ''}
     */
    socketSend(ws, data){
        try{
            ws.send(JSON.stringify(data))
        }
        catch(e){
            console.error(e)
        }
    }
}



module.exports = WsServer
