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

        if(self.options.log)
        console.debug(Date(), 'websocket connected', req.url)

        helpers.asyncMiddleware(this, this.sequence, req, ws, function(err, req, ws){
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
            if(self.options.log)
            self.start = new Date().valueOf()
            try {
            data = JSON.parse(data.toString())
            // create the path to the database
            data.db = self.options.path + req.url.split(self.prefix)[1]
            if(data)
            self.handler(data, ws)
            }
            catch(e){
            console.error(e)
            ws.send(JSON.stringify({ err : 'internal error.', data : null}))
            }
        })
        
        ws.on('close', function disconnect(){
            self.pubsub.destroy(ws)
        })
        ws.on('error', function(){
            self.pubsub.destroy(ws)
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
            ws.send(JSON.stringify({ err : null, data : data.meta + 'd' }))
        }
        else{
            if(data.meta === 'list'){
            this.db.queryList(data.data, function(docs){
                if(self.options.log){
                    let stop = new Date()
                    console.debug(Date(), 'websocket', data.db, data.meta, stop.valueOf() - self.start + ' ms')
                }
                ws.send(JSON.stringify(docs))
            }) 
            }
            else{
            this.db.query(data.db, data.meta, data.data, function(docs){
                if(self.options.log){
                    let stop = new Date()
                    console.debug(Date(), 'websocket', data.db, data.meta, stop.valueOf() - self.start + ' ms')
                }
                ws.send(JSON.stringify(docs))
            }) 
            }
        }
        data.meta = this.pubsub.convertMeta(data.meta)
        this.pubsub.handle(data.meta, data.data, ws)
    }
}



module.exports = WsServer
