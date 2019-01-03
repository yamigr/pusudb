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
const Utility = require('./Utility')

class WsServer extends Utility {

    constructor(host, pubsub, opt){
        super(opt, host, pubsub)
        this.options = typeof opt === 'object' ? opt : {}
        this.pubsub = pubsub
        this.sequenceConnection = []
        this.sequence = []
        this.sequenceBefore = []
        this.start = 0
    }

    /**
     * websocket connection
     * @param {object} server http server instance
     */
    attachToHttp(server){
        this._wss =  new WebSocket.Server( { server : server } );
        this._wss.on('connection', this.middleware.bind(this));
        this.ping()
    }

    /**
     * websocket connection
     * @param {object} cfg configuration
     */
    attachSelf(cfg){
        this._wss =  new WebSocket.Server( { host : cfg.host, port : parseInt(cfg.port) } );
        this._wss.on('connection', this.middleware.bind(this));
    }

   /**
     * bind the middlewares to this, called by Server
     * @param {array} seq 
     */
    use(seq){
        this.sequence = helpers.bindMiddleware(this, seq)
    }

    /**
     * bind the middlewares to this, called by Server
     * @param {array} seq 
     */
    useBefore(seq){
        this.sequenceBefore = helpers.bindMiddleware(this, seq)
    }

    /**
     * bind the middlewares to this, called by Server
     * @param {array} seq 
     */
    useConnect(seq){
        this.sequenceConnection = helpers.bindMiddleware(this, seq)
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
        this.pong(ws)
        try{
            this.consoleLogger(new Date().valueOf(), 'WS', 'connected ' + req.url)
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
            self._wss.clients.forEach(function each(ws) {
                if (ws.isAlive === false) return ws.terminate();
                ws.isAlive = false;
                ws.ping(function(){ /* Noob */});
            });
        }, this.options.heartbeat);
    }

    pong(ws){
        ws.isAlive = true;
        this._wss.on('pong', this.heartbeat);
    }

    heartbeat() {
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

            // Set start timestamp
            if(self.options.log){
                self.start = new Date().valueOf()
            }

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
                            req.docs = Object.assign(req.docs, { db : req.body.db, meta : req.body.meta }, docs)
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
                self.consoleLogger(self.start, 'WS', 'err: ' +  req.docs.err + ', ' + req.body.db + ' ' +  req.body.meta)
            })
        })
        
        ws.on('close', function disconnect(){
            self.pubsub.handle( 'destroy', '', ws)
        })
        ws.on('error', function(){
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
