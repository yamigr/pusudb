const WebSocket = require('ws');
const EventEmitter = require('events').EventEmitter;
const async = require('async')
const path = require('path')
var helpers = require('./helpers')

class WsServer extends EventEmitter {

    constructor(server, db, pubsub, opt){
        super();
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
     * websocket connection and message
     * @param {object} server http server instance
     */
    create(server){
        let self = this
        this.use()
        this.options.path = this.options.path ? this.options.path : '.'
        this._wss =  new WebSocket.Server( { server : server } );
        this._wss.on('connection', this.middleware.bind(this));
    }

    /** 
     * with use the server get all middleware functions and bind this to it, to get the req and res obj.
    */
    use(){
        this.sequence = helpers.bindMiddleware(this, this.sequence)
    }

    /**
     * This method will be called on each request and handles the middleware in series.
     * THe response-header should be create on middleware-side
     * @param {object} req 
     * @param {object} res 
     */
    middleware(ws, req){
        let self = this

        if(self.options.log)
        console.debug(Date(), 'websocket connected', req.url)

        async.forEach(this.sequence, function(fn, index, next){
            fn.call(self, req, ws, function(err){
                next(err)
            })
        }, function(err){
            if(!err){
                self.handelReqRes(req, ws)
            }
        })
    }

    /**
     * Final function to get the data and handle the response
     * @param {object} req 
     * @param {object} ws 
     */
    handelReqRes(req, ws){
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
            ws.send(JSON.stringify({ err : 'internal error. check pathname or data is json', data : null}))
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
