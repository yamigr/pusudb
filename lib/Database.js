"use strict"
const tcpleveldb = require('tcpleveldb')

var helpers = require('./helpers')


class Database {

    constructor(host){
        this._port
        this._host = host
        this.db
        this.srv = {}
        this.createServer()
        this.createClient()
    }

    get port(){
        return this._port
    }

    get host(){
        return this._host
    }

    createServer(){
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