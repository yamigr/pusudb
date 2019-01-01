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
        this.db.on('error', function(err){console.error(err)})
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
        req.docs = { err: '', data : '' }
        // holds the render data
        req.render = {}
        // User if auth is active
        req.user = {}
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
            noExtDb : arguments[1],
            meta : arguments[2],
            data : arguments[3]
        }
    }

    hasPrefix(str){
        return str.indexOf(this.prefix) !== -1 ? true : false
    }

    /**
     * Check if the db can be queried
     * @param {string} url 
     * @param {object} api the api object
     */
    enableQueryDb(url, api){
        let isInDbList = true
        let isNotInBlockedList = true

        if(this.options.db_list.length){
            isInDbList = this.options.db_list.indexOf(api.noExtDb) !== -1 ? true : false
        }

        if(this.options.db_block.length){
            isNotInBlockedList = this.options.db_block.indexOf(api.noExtDb) === -1 ? true : false
        }

        return this.hasPrefix(url) && isInDbList && isNotInBlockedList
    }

    /**
     * parse the path into array
     * @param {string} path path of the url
     */
    parseParam(path){
        let obj = {}
        let pathtmp = path.split(this.prefix + '/')
        obj.path = pathtmp[0]
        obj.noExtDb = null
        obj.db =  null
        obj.meta = null
        try{
            //if it has a api part parse db-name and action
            pathtmp =  pathtmp[1].split('/')
            obj.noExtDb = pathtmp[0]
            obj.db =  helpers.concatDbPath(this.options.path, pathtmp[0])
            obj.meta = pathtmp[1]
        }
        catch(e){
        }
        return obj
    }

    parseParamInBody(body){
        let obj = {}
        obj.path = null
        obj.noExtDb = body.db
        obj.db =  helpers.concatDbPath(this.options.path, body.db)
        obj.meta = body.meta
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

    // check if params has a only one key named 'value' then return params else create filter object with value : params
    convertFilterParam(params){
        if(Object.keys(params).length === 1 && params.value){
            return params
        }
        else{
            return { value : params }
        }
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
    handlerQueryAndPubSub(data, req, ws, callback){
        let self = this
        callback = callback || req

        if(typeof req === 'function'){
            ws = null
            req = null
        }

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
                this.pubsub.handle( data.noExtDb, data.meta, data.data, req, ws)
                callback({ err : null, data : data.data.key || data.data || null })
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

                        // if batch, convert the data to send to subscriber
                        if(data.meta === 'batch'){
                            data.data = self.pubsub.convertBatch(data.data)
                        }

                        // if update then qet the actual data to publishing
                        if(data.meta === 'update'){
                            self.db.query(data.db, 'get', { key : docs.data }, function(docs){
                                self.pubsub.handle( data.noExtDb, data.meta, docs.data, req, ws )
                            }) 
                        }
                        else{
                            self.pubsub.handle( data.noExtDb, data.meta, data.data, req, ws)
                        }
                        
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