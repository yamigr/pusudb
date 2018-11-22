/** 
 * Autor: yannick grund, 2018
 * This class implements the pusudb
 * With the method use and useBefore it's possible to add custom middlewares to the certain protocol
 * It's possible to add the middleware before listen, or in runtime
*/

var tcpleveldb = require('tcpleveldb')

var Database = require('./Database')
var ServerHttp = require('./ServerHttp')
var ServerWs = require('./ServerWs')
var PubSub = require('./PubSub')
var helpers = require('./helpers')

class DbServer {

    constructor(port, host, opt){
        this.options = typeof opt === 'object' ? opt : {}
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222
        this._pubsub = new PubSub(this.options)
        this._db = new Database(this._host)
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
        this._db
    }

    get port(){
        return this._port
    }

    get host(){
        return this._host
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
     * Start the server (http and ws)
     * @param {function} callback 
     */
    listen(callback){
        callback = helpers.callbackNoob(callback)
        let self = this
        this._db.createServer(function(port, host){
            // create the server instances

            // add a uniqueId-key which should be replaced by a unique id when data is putted into db
            if(self.options.uniqueId){
                self._db.db.key = self.options.uniqueId
            }
      
            self._serverHttp = new ServerHttp(self._port, self._host, self._db, self._pubsub, self.options)
            // call middlewares
            self._serverHttp.use(self.middleware._http)
            self._serverHttp.useBefore(self.middlewareBefore._http)
            //server listen
            self._serverHttp.listen(function(port, host){
                callback(port, host)
            })

            // the websocket-server has the same host and port like the webserver
            self._serverWs = new ServerWs(self._serverHttp.server, self._db, self._pubsub, self.options)
            //call middlewares
            self._serverWs.use(self.middleware._ws)
            self._serverWs.useBefore(self.middlewareBefore._ws)
        })
    }

}




module.exports = DbServer
