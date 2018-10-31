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

        // create the server instances
        this._serverHttp = new ServerHttp(this._port, this._host, this._db, this._pubsub, this.middleware._http)
        this._serverHttp.listen(function(port, host){
            callback(port, host)
        })

        // the websocket-server has the same host and port like the webserver
        this._serverWs = new ServerWs(this._serverHttp.server, this._db, this._pubsub, this.middleware._ws)

    }

}




module.exports = DbServer
