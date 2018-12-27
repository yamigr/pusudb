/** 
 * Autor: yannick grund, 2018
 * This class implements the pusudb
 * With the method use and useBefore it's possible to add custom middlewares to the certain protocol
 * It's possible to add the middleware before listen, or in runtime
 * 
 * ToDo: add https and wss
*/

const tcpleveldb = require('tcpleveldb')

const ServerHttp = require('./ServerHttp')
const ServerWs = require('./ServerWs')
const PubSub = require('./PubSub')
const helpers = require('./helpers')

const async = require('async')

class DbServer {

    constructor(port, host, opt){
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222

        this.options = typeof opt === 'object' ? opt : {}
        this.options.path = this.options.path ? this.options.path : '.'
        this.options.db_port = this.options.db_port || parseInt(this._port) + 1
        this.options.db_list = this.options.db_list || []
        this.options.db_block = this.options.db_block || []
        this.options.http_active = this.options.http_active || true
        this.options.ws_active = this.options.ws_active || true

        this.pubsub = new PubSub(this.options)
        this.db =  new tcpleveldb.Server( this.options.db_port, this._host )

        this._serverHttp = {}
        this._serverWs = {}

        this.middleware = {
            _http : [],
            _ws : []   
        }
        this.middlewareBefore = {
            _http : [],
            _ws : []   
        }
        this.middlewareConnect = {
            _ws : []   
        }
    }

    get port(){
        return this._port
    }

    get host(){
        return this._host
    }

    encodeJsonToBase64(decoded){
        return helpers.encodeJsonToBase64(decoded)
    }

    decodeBase64ToJson(encoded){
        return helpers.decodeBase64ToJson(encoded)
    }

    /**
     * bind some middleware-function to the certain protocol
     * @param {string} type 
     * @param {function} middleware 
     */
    use(type, middleware){

        switch(type){
            case 'http':
            this.middleware._http.push(middleware)
            if( this._serverHttp instanceof ServerHttp )
            this._serverHttp.use(this.middleware._http)
            break
            case 'ws':
            this.middleware._ws.push(middleware)
            if( this._serverWs instanceof ServerWs )
            this._serverWs.use(this.middleware._ws)
            break
            default:
                throw new Error('use http or ws to bind the middleware-function to the certain protocol')
            break
        }
 
    }

    /**
     * bind some middleware-function to the certain protocol
     * @param {string} type 
     * @param {function} middleware 
     */
    useBefore(type, middleware){

        switch(type){
            case 'http':
            this.middlewareBefore._http.push(middleware)
            if( this._serverHttp instanceof ServerHttp )
            this._serverHttp.useBefore(this.middlewareBefore._http)
            break
            case 'ws':
            this.middlewareBefore._ws.push(middleware)
            if( this._serverWs instanceof ServerWs )
            this._serverWs.useBefore(this.middlewareBefore._ws)
            break
            default:
                throw new Error('use http or ws to bind the middleware-function to the certain protocol')
            break
        }
 
    }

    /**
     * bind some middleware-function to the certain protocol
     * @param {string} type 
     * @param {function} middleware 
     */
    useConnect(type, middleware){

        switch(type){
            case 'ws':
            this.middlewareConnect._ws.push(middleware)
            if( this._serverWs instanceof ServerWs )
            this._serverWs.useConnect(this.middlewareConnect._ws)
            break
            default:
                throw new Error('use ws to bind the middleware-function')
            break
        }
 
    }

    /**
     * Start the server (http and ws)
     * @param {function} callback 
     */
    listen(callback){
        callback = callback || function(){}
        let self = this
        this.db.listen(function(port, host){
            async.series([
                function(next){
                    if(self.options.http_active){
                        self.initHttp(function(port, host){
                            next()
                        })
                    }
                    else{
                        next()
                    }
                },
                function(next){
                    if(self.options.ws_active && self.options.http_active){
                        self.intWs()
                        self._serverWs.attachToHttp(self._serverHttp.server)
                        next()
                    }
                    else if(self.options.ws_active) {
                        self.intWs()
                        self._serverWs.attachSelf(Object.assign({ port : self._port, host : self._host }, self.options))
                        next()
                    }
                    else{
                        next()
                    }
                }
            ],function(err){
                callback( self._port, self._host)
            })
        }) 

        this.db.on('error', function(err){console.log(err)})
    }

    initHttp(callback){
        let self = this
        this._serverHttp = new ServerHttp(this._port, this._host, this.pubsub, this.options)
        // call middlewares
        this._serverHttp.use(this.middleware._http)
        this._serverHttp.useBefore(this.middlewareBefore._http)
        this._serverHttp.listen(function(port, host){
            callback(port, host)
        })
    }

    intWs(){
        // the websocket-server has the same host and port like the webserver
        this._serverWs = new ServerWs(this._host, this.pubsub, this.options)
        //call middlewares
        this._serverWs.use(this.middleware._ws)
        this._serverWs.useBefore(this.middlewareBefore._ws)
        this._serverWs.useConnect(this.middlewareConnect._ws)
    }

}

module.exports = DbServer
