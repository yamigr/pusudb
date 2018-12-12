/** 
 * Autor: yannick grund, 2018
 * This class implements the pusudb
 * With the method use and useBefore it's possible to add custom middlewares to the certain protocol
 * It's possible to add the middleware before listen, or in runtime
 * 
 * ToDo: add https and wss
*/

var tcpleveldb = require('tcpleveldb')

var ServerHttp = require('./ServerHttp')
var ServerWs = require('./ServerWs')
var PubSub = require('./PubSub')
var helpers = require('./helpers')

class DbServer {

    constructor(port, host, opt){
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222

        this.options = typeof opt === 'object' ? opt : {}
        this.options.path = this.options.path ? this.options.path : '.'
        this.options.db_port = this.options.db_port || parseInt(this._port) + 1

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
        callback = helpers.callbackNoob(callback)
        let self = this

        this.db.listen(function(port, host){
            self.init(function(port, host){
                callback(port, host)
            })
        }) 

        this.db.on('error', function(err){console.log(err)})
    }

    init(callback){
        let self = this
        this._serverHttp = new ServerHttp(this._port, this._host, this.pubsub, this.options)
        // call middlewares
        this._serverHttp.use(this.middleware._http)
        this._serverHttp.useBefore(this.middlewareBefore._http)
        this._serverHttp.listen(function(port, host){
            self.intWs()
            callback(port, host)
        })
    }

    intWs(){
        // the websocket-server has the same host and port like the webserver
        this._serverWs = new ServerWs(this._host, this._serverHttp.server, this.pubsub, this.options)
        //call middlewares
        this._serverWs.use(this.middleware._ws)
        this._serverWs.useBefore(this.middlewareBefore._ws)
        this._serverWs.useConnect(this.middlewareConnect._ws)
    }

}

module.exports = DbServer
