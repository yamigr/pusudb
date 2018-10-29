"use strict"
const tcpleveldb = require('tcpleveldb')

var helpers = require('./helpers')


class Database {

    constructor(host){
        this._port
        this._host = host
        this.db = {
            _http : {},
            _ws : {}
        }
        this.srv = {}
        this.handler_srv()
        this.handler_client()

    }

    isOpen(){
        return this._db.isOpen()
    }

    isClose(){
        return this._db.isClosed()
    }

    handler_srv(host){
        for(let p = 52000; p < 65535; p++ ){
            try{
                this._port = p
                this.srv  = new tcpleveldb.Server( this._port, this._host)
                this.srv.listen() 
                this.srv.on('error', function(err){console.log(err)})
                break;
            }
            catch(e){

            }
        }
    }

    handler_client(){
        this.db._http = new tcpleveldb.Client(this._port, this._host)
        this.db._ws = new tcpleveldb.Client(this._port, this._host)

        this.db._http .on('error', function(err){console.log(err)})
        this.db._http .on('error', function(err){console.log(err)})
    }

    handler(src, path, method, data, callback){
        let self = this
        callback = helpers.callbackNoob(callback)

        switch(method){
            case 'get':
            this.db[src].get(path, data.key, function(err, data){
                callback({ err : err, data : data})
            })
            break
            case 'put':
            this.db[src].put(path, data, function(err){
                callback({ err : err, data : data.key})
            })
            break
            case 'del':
            this.db[src].del(path, data.key, function(err){
                callback({ err : err, data : data.key})
            })
            break
            case 'batch':
            this.db[src].batch(path, data, function(err){
                callback({ err : err, data : data.length})
            })
            break
            case 'stream':
            this.db[src].stream(path, data, function(err, data){
                callback({ err : err, data : data})
            })
            break
            case 'count':
            this.db[src].count(path, data, function(err, numb){
                callback({ err : err, data : numb})
            })
            break
            case 'filter':
            this.db[src].filter(path, data.value, function(err, docs){
                callback({ err : err, data : docs})
            })
            break
            case 'update':
            this.db[src].update(path, data, function(err, docs){
                callback({ err : err, data : data})
            })

            break
            default:
            callback({ err : 'query not exist.', data : ''})
            break
        }
    }
}

module.exports = Database;