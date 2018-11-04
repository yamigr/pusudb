const EventEmitter = require('events').EventEmitter;
var tcpleveldb = require('tcpleveldb')

var Database = require('./Database')
var ServerHttp = require('./ServerHttp')
var ServerWs = require('./ServerWs')
var PubSub = require('./PubSub')
var helpers = require('./helpers')

class DbServer extends EventEmitter {

    constructor(port, host){
        super();
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222
        this._pubsub = new PubSub()
        this._db = new Database(this._host)
        this._serverHttp = {}
        this._serverWs = {}
        this.middleware = {
            _http : [],
            _ws : []   
        }
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
            break
            case 'ws':
            this.middleware._ws.push(middleware)
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
            self._serverHttp = new ServerHttp(self._port, self._host, self._db, self._pubsub, self.middleware._http)

            self._serverHttp.listen(function(port, host){
                callback(port, host)
            })

            // the websocket-server has the same host and port like the webserver
            self._serverWs = new ServerWs(self._serverHttp.server, self._db, self._pubsub, self.middleware._ws)
        })
    }

}




module.exports = DbServer
