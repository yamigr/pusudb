/** 
 * Autor: yannick grund, 2018
*/
const tcpleveldb = require('tcpleveldb')
const EventEmitter = require('events')
const url = require('url');
const parse = require('querystring').parse;
const async = require('async')
const path = require('path')
const helpers = require('./helpers')


class Utility extends EventEmitter {

    constructor(options, host, pubsub){
        super()
        this.options = options
        this.host = host
        this.pubsub = pubsub
        this.db = new tcpleveldb.Client(this.options.db_port , this.host)
        this.db.key = this.options.uniqueId || '@key'
        this.db.on('error', function(err){console.log(err)})
        this.prefix = this.options.prefix || '/api'
    }

    /**
     * define the global pusudb variables
     * @param {object} req 
     * @param {boolean} parsePathname parse the pathname into db, meta and path 
     */
    defineRequestProps(req, parsePathname){
        //parse the url query
        req.params = {}
        req.params = url.parse(req.url, true)
        // hilds the body
        req.body = {}
        //add the db-metas to the req object to handle it in a middleware
        req.meta = {}
        //get the meta action keys by database
        req.meta = this.db.metaNames
        // holds the database docs
        req.docs = { err: '', data : '', locals : null}
        // parse the url parameter -> url, the pusudb object can be accessed in the middleware
        req.params.api = {}

        if(parsePathname)
        req.params.api = this.parseParam(req.params.pathname)

        req.db = this.db
        req.pubsub = this.pubsub

        return req
    }

    defineResponseProps(res){
        /************************************ */
        // default statuscode 0
        res.statusCode = 0;

        return res
    }

    buildPackage(){
        return {
            db : arguments[0],
            meta : arguments[1],
            data : arguments[2]
        }
    }

    hasPrefix(str){
        return str.indexOf(this.prefix) !== -1 ? true : false
    }

    /**
     * parse the path into array
     * @param {string} path path of the url
     */
    parseParam(path){
        let obj = {}
        let pathtmp = path.split(this.prefix)
        obj.path = pathtmp[0]
        try{
            //if it has a api part parse db-name and action
            pathtmp =  pathtmp[1].split('/')
            obj.db =  helpers.concatDbPath(this.options.path, pathtmp[1])
            obj.meta = pathtmp[2]
        }
        catch(e){
        }
        return obj
    }


    /**
     * convert query-object prop limmit and reverse to bool or number
     * @param {object} opt 
     */
    convertOptions(opt){
        try{
            if(opt.limit){
                opt.limit = parseInt(opt.limit)
            }
            if(opt.reverse){
                opt.revers = opt.revers === 'true' ? true : false
            }
        }
        catch(e){

        }
        return opt
    }


    handleQueryList(data, callback){
        let self = this
        let data = {}
        async.forEach(data.data, function(element, next){
            self.db.query(element.db, element.meta, element.data, function(docs){
                data[element.name] = docs
                next()
            })
        }, function(err){
            callback(data)
        })
    }


    /**
     * handle the database or the publish-subscribe pattern
     * 
     * @param {object} data data-package db,meta,data
     * @param {object} ws websocket
     * @param {function} callback package to sending to client
     */
    handlerQueryAndPubSub(data, ws, callback){
        let self = this
        callback = callback || ws
        ws = (typeof ws === 'function') ? null : ws

        if(!data.db || !data.data){
            callback({ err : 'Empty data.', data : null })
        }
        else{
            // If it is a base64-encoded-string -> decode or parse the list
            if(data.data.hash){
                data.data = helpers.decodeBase64ToJson(data.data.hash)
            }

            // if meta subscribe or unsubscribe handle the socket in pubsub
            if(data.meta === 'subscribe' || data.meta === 'unsubscribe' || data.meta === 'publish'){
                // Log to console
                this.pubsub.handle( data.db, data.meta, data.data, ws)
                callback({ err : null, data : data.meta })
            }
            else{
                // if querying multiple
                if(data.meta === 'list'){
                    this.handleQueryList(data, function(docs){
                        callback(docs)
                    })
                }
                else{

                    this.db.query(data.db, data.meta, data.data, function(docs){
                        // Add key to data. It's possible to create uniqueId's. That's why we need to get the real key here
                        helpers.writeKeyIfNewUniqueId(data, docs)
                        if(data.meta === 'batch'){
                            data.data = self.pubsub.convertBatch(data.data)
                        }
                        self.pubsub.handle( data.db, self.pubsub.convertMeta(data.meta), data.data, ws)
                        callback(docs)
                    }) 
                }
            }
        }
    }

    /**
     * 
     * @param {object} data 
     */
    consoleLogger(time, name, data){
        if(this.options.log){
            console.debug(name, Date(), data, new Date().valueOf() - time + ' ms')
        }
    }
}

module.exports = Utility;