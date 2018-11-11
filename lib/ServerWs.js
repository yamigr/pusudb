const WebSocket = require('ws');
const EventEmitter = require('events').EventEmitter;
const async = require('async')

var helpers = require('./helpers')

class WsServer extends EventEmitter {

    constructor(server, db, pubsub, middleware){
        super();
        this.db = db
        this.pubsub = pubsub
        this.sequence = Array.isArray(middleware) ? middleware : []
        this.create(server)
    }

    /**
     * websocket connection and message
     * @param {object} server http server instance
     */
    create(server){
        let self = this
        this.use()
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
        async.eachOfSeries(this.sequence, function(fn, index, next){
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
            try {
                data = JSON.parse(data.toString())
                data.db = '.' + req.url
                self.handler(data, ws)
            }
            catch(e){
                console.error(e)
                ws.send(JSON.stringify({ err : 'internal error', data : null}))
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
        if(data.meta === 'subscribe' || data.meta === 'unsubscribe'){
            ws.send(JSON.stringify({ err : null, data : data.meta + 'd' }))
        }
        else{
            this.db.query(data.db, data.meta, data.data, function(docs){
                ws.send(JSON.stringify(docs))
            }) 
        }
        data.meta = this.pubsub.convertMeta(data.meta)
        this.pubsub.handle(data.meta, data.data, ws)
    }
}



module.exports = WsServer
