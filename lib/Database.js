"use strict"
const tcpleveldb = require('tcpleveldb')
const portfinder = require('portfinder');
portfinder.basePort = 52000; 

var helpers = require('./helpers')

class Database {

    constructor(host){
        this._port
        this._host = host
        this.db
        this.srv = {}
    }

    get port(){
        return this._port
    }

    get host(){
        return this._host
    }

    get meta(){
        console.log('...........................')
        try{
            return this.db.metaNames
        }
        catch(e){
            return {}
        }
    }

    createServer(callback){
        let self = this
        portfinder.getPortPromise()
        .then((port) => {
            self._port = port
            self.srv  = new tcpleveldb.Server( self._port, self._host)
            self.srv.listen() 
            self.srv.on('error', function(err){console.log(err)})
            self.createClient()
            callback(self._port, self._host)
        })
        .catch((err) => {
            console.error(err)
        });
    }

    createClient(){
        this.db = new tcpleveldb.Client(this._port, this._host)
        this.db.on('error', function(err){console.log(err)})
    }

    /**
     * 
     * @param {string} db dbname / path
     * @param {string} meta 
     * @param {object} data 
     * @param {function} callback 
     */
    query(db, meta, data, callback){
        this.db.query(db, meta, data, function(docs){
            callback(docs)
        })
    }
    
}

module.exports = Database;