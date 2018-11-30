/** 
 * Autor: yannick grund, 2018
 * This class implements the websocket-server to the pusudb
 * It shares the same port like the http-server
 * Over websocket it's possible to handle the normal queries for the database
 * But it's also possible to publish or subscribe the data. When someone put or update a certain entry, all subscribed sockets receives the data.
 * Wildcards are supported by #
*/

const WebSocket = require('ws');
const url = require('url');
const parse = require('querystring').parse;
const path = require('path')
const async = require('async')
var helpers = require('./helpers')

class WsServer {

    constructor(server, db, pubsub, opt){
        this.db = db
        this.pubsub = pubsub
        this.sequenceConnection = []
        this.sequence = []
        this.sequenceBefore = []
        this.options = typeof opt === 'object' ? opt : {}
        this.prefix = typeof this.options.prefix !== 'undefined' ? this.options.prefix : '/api'
        this.start = 0
        this.create(server)
    }

    /**
     * websocket connection
     * @param {object} server http server instance
     */
    create(server){
        this.options.path = this.options.path ? this.options.path : '.'
        this._wss =  new WebSocket.Server( { server : server } );
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

        // Add the db and the pubsub instance to the req, to handle it in other middlewares
        req.db = this.db
        req.pubsub = this.pubsub
        //parse the url query
        req.params = {}
        req.params = url.parse(req.url, true)
        req.body = {}
        req.docs = {}

        try{
            if(this.options.log)
            this.start = new Date().valueOf()

            this.consoleLogger('connected ' + req.url)

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
                        req.body.db =  helpers.concatDbPath(self.options.path, req.body.db)
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
                    if(req.url === self.prefix){
                        self.handlerQueryAndPubSub(req.body, ws, function(docs){
                            req.docs = Object.assign(req.docs, docs)
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
                    self.socketSend(ws, { err : err, data : null})
                }
                else{
                    self.socketSend(ws, req.docs)
                }
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
     * handle the database or the publish-subscribe pattern
     * 
     * @param {object} data data-package db,meta,data
     * @param {object} ws websocket
     * @param {function} callback package to sending to client
     */
    handlerQueryAndPubSub(data, ws, callback){
  
        // If it is a base64-encoded-string -> decode or parse the list
        if(data.data && data.data.hash){
            data.data = helpers.decodeBase64ToJson(data.data.hash)
        }

        // if meta subscribe or unsubscribe handle the socket in pubsub
        if(data.meta === 'subscribe' || data.meta === 'unsubscribe'){
            // Log to console
            this.handlePubSub(data, ws, function(docs){
                callback(docs)
            })
        }
        else{
            // if querying multiple
            if(data.meta === 'list'){
                this.handleQueryList(data, function(docs){
                    callback(docs)
                })
            }
            else{
                this.handleQuery(data, ws, function(docs){
                    callback(docs)
                })
            }
        }

    }

    /**
     * Handle the publish and subscribe patern
     * @param {object} data 
     * @param {object} ws 
     * @param {function} callback package to sending to client
     */
    handlePubSub(data, ws, callback){
        this.consoleLogger(data)
        this.pubsub.handle( this.pubsub.convertMeta(data.meta), data.data, ws)
        callback({ err : null, data : data.meta + 'd' })
    }
    
    handleQueryList(data, callback){
        let self = this
        this.db.queryList(data.data, function(docs){
            // Log to console
            self.consoleLogger(data)
            callback(docs)
        }) 
    }
    /**
     * Handle a single query
     * @param {object} data 
     * @param {object} ws 
     * @param {function} callback 
     */
    handleQuery(data, ws, callback){
        let self = this
        this.db.query(data.db, data.meta, data.data, function(docs){
            // Log to console
            self.consoleLogger(data)
            // Add key to data. It's possible to create uniqueId's. That's why we need to get the real key here
            if(data.data && data.data.key && docs.data && docs.data.key){
                data.key = docs.data.key
            }
            self.pubsub.handle( self.pubsub.convertMeta(data.meta), data.data, ws)
            callback(docs)
        }) 
    }

    /**
     * 
     * @param {object} data 
     */
    consoleLogger(data){
        if(this.options.log){
            let stop = new Date()
            console.debug('WEBSOCKET', Date(), data, stop.valueOf() - this.start + ' ms')
        }
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
