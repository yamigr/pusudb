/** 
 * Autor: yannick grund, 2018
 * This class implements the websocket-server to the pusudb
 * It shares the same port like the http-server
 * Over websocket it's possible to handle the normal queries for the database
 * But it's also possible to publish or subscribe the data. When someone put or update a certain entry, all subscribed sockets receives the data.
 * Wildcards are supported by #
*/

const WebSocket = require('ws');
const path = require('path')
var helpers = require('./helpers')

class WsServer {

    constructor(server, db, pubsub, opt){
        this.db = db
        this.pubsub = pubsub
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
     * INFO: not yet implemented in this class. Waiting for usecase
     * @param {array} seq 
     */
    useBefore(seq){
        this.sequenceBefore = helpers.bindMiddleware(this, seq)
    }

    /**
     * This method will be called when a socket is connecting
     * @param {object} ws 
     * @param {object} req 
     */
    middleware(ws, req){
        let self = this
        if(this.options.log)
        this.start = new Date().valueOf()
        this.consoleLogger('connected ' + req.url)
        helpers.asyncMiddleware(this, this.sequenceBefore, req, ws, function(err, req, ws){
            self.handleRequestAndSendTheData(req, ws)
        })
    }

    /**
     * Final function to get the data and handle the response
     * @param {object} req 
     * @param {object} ws 
     */
    handleRequestAndSendTheData(req, ws){
        let self = this
        
        ws.on('message', function incoming(data) {

            helpers.asyncMiddleware(self, self.sequence, req, ws, function(err, req, ws){
                if(self.options.log){
                    self.start = new Date().valueOf()
                }
                try {
                    // parse the data to json
                    data = JSON.parse(data.toString())
                    // create the path to the database
                    data.db = self.options.path + req.url.split(self.prefix)[1]
                    self.handler(data, ws)
                }
                catch(e){
                    try{
                        ws.send(JSON.stringify({ err : 'internal error.', data : null}))
                    }
                    catch(e){
                        console.error(e)
                    }
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
     * handle the database
     * @param {object} data data-package db,meta,data
     * @param {object} ws websocket
     */
    handler(data, ws){
        let self = this

        if(data.meta === 'subscribe' || data.meta === 'unsubscribe'){
            // Log to console
            self.consoleLogger(data)
            self.pubsub.handle( self.pubsub.convertMeta(data.meta), data.data, ws)
            ws.send(JSON.stringify({ err : null, data : data.meta + 'd' }))
        }
        else{
            if(data.meta === 'list'){

            // If it is a base64-encoded-string -> decode or parse the list
            if(data.data.hash){
                data.data = helpers.decodeBase64ToJson(data.data.hash)
            }
            
            this.db.queryList(data.data, function(docs){
                // Log to console
                self.consoleLogger(data)
                ws.send(JSON.stringify(docs))
            }) 
            }
            else{
            this.db.query(data.db, data.meta, data.data, function(docs){
                // Log to console
                self.consoleLogger(data)
                // Add key to data. It's possible to create uniqueId's. That's why we need to get the real key here
                if(data.data && data.data.key && docs.data && docs.data.key){
                    data.key = docs.data.key
                }
                self.pubsub.handle( self.pubsub.convertMeta(data.meta), data.data, ws)
                ws.send(JSON.stringify(docs))
            }) 
            }
        }

    }

    consoleLogger(data){
        if(this.options.log){
            let stop = new Date()
            console.debug('WEBSOCKET', Date(), data, stop.valueOf() - this.start + ' ms')
        }
    }
}



module.exports = WsServer
