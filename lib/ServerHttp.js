/** 
 * Autor: yannick grund, 2018
 * This class implements the http-server in the pusudb
 * It parses the request, handle the custom middlewares and sending the response to the client
 * It's possible to add middlewares before or after the database-query
*/
const http = require('http');
const url = require('url');
const parse = require('querystring').parse;
const async = require('async')
var path = require('path')
var helpers = require('./helpers')

class HttpServer {

    constructor(port, host, db, pubsub, opt){
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222
        this.db = db
        this.pubsub = pubsub
        this.sequence = []
        this.sequenceBefore = []
        this.options = typeof opt === 'object' ? opt : {}
    }

    get server(){
        return this._server
    }

    /**
     * Start listen the server
     * @param {function} callback return port, host
     */
    listen(callback){
        callback = helpers.callbackNoob(callback)
        let self = this

        // create the server
        this._server = this.create();
        
        // server listen
        this._server.listen(this._port, this._host, function(){
            callback(self._port, self._host)
        })
    }

    /**
     * bind the middlewares to this, called by Server
     * @param {array} seq 
     */
    use(seq){
        this.sequence = helpers.bindMiddleware(this, seq)
    }

    /**
     * bind the middlewares to this, called by Server
     * @param {array} seq 
     */
    useBefore(seq){
        this.sequenceBefore = helpers.bindMiddleware(this, seq)
    }

    /**
     * This method will be called on each request and handles the middleware in series.
     * First it parses the query params, the body if it has one
     * After the parsing, the middleware before are called, then it starts to query the db, then the normal middleware are called
     * at the end the http response is fired
     * @param {object} req 
     * @param {object} res 
     */
    middleware(req, res){
        let self = this
        if(this.options.log)
        req.start = new Date().valueOf()

        //prepare the req variables
        this.defineRequestResponseProps(req, res)

        async.series([
            //parse body
            function(done){
                self.createDataFromReq(req, function(body){
                    req.body = body
                    done()
                })
            },
            // middleware invoked before the db-query
            function(done){
                helpers.asyncMiddleware(self, self.sequenceBefore, req, res, function(err, req, res){
                    done(err)
                })
            },
            //query the database and put the data to the request
            function(done){
                self.handelQuery(req, function(err, docs){
                    req.docs = docs
                    self.handleDocs(req, res);
                    done(err)
                })
            },
            // middleware - invoked after the db-query
            function(done){
                helpers.asyncMiddleware(self, self.sequence, req, res, function(err, req, res){
                    done(err)
                })
            },
            // sending the response
            function(done){
                // write the result and fire the response
                self.handleWriteEnd(req, res)
                done()
            }
        ], function(err){
            // log on console
            if(self.options.log){
                console.debug(Date(), req.method, req.params.pathname, res.statusCode, new Date().valueOf() - req.start + ' ms')
            }
        })

    }

    /** 
     * create the server and bind all middlewares
    */
    create(){
        return new http.createServer(this.middleware.bind(this))
    }

    /**
     * define the global pusudb variables
     * @param {object} req 
     * @param {object} res
     */
    defineRequestResponseProps(req, res){
        //parse the url query
        req.params = {}
        req.params = url.parse(req.url, true)
        // hilds the body
        req.body = {}
        //add the db-metas to the req object to handle it in a middleware
        req.meta = {}
        //get the meta action keys by database
        req.meta = this.db.meta
        // holds the database docs
        req.docs = { err: '', data : ''}
        // parse the url parameter -> url, the pusudb object can be accessed in the middleware
        req.params.api = {}
        req.params.api = this.parseParam(req.params.pathname)

        /************************************ */
        // default statuscode 500
        res.statusCode = 500;
    }

    /**
     * Query the db
     * @param {object} req 
     * @param {function} callback return err, docs
     */
    handelQuery(req, callback){
        if(req.params.api.db && req.params.api.meta){
            try{
                this.handleQueryCases(req, function(docs){
                    callback(null, docs)
                })
            }
            catch(e){
                console.error(e)
                callback(e, null)
            }
        }
        else{
            callback(null, null)
        }
    }

    /**
     * handle the query cases for each method
     * @param {object} req 
     * @param {function} callback return docs
     */
    handleQueryCases(req, callback){
        switch(req.method){
            case 'GET':
            if(req.params.api.meta === 'stream' || req.params.api.meta === 'count' ){
                this.convertOptions(req.params.query)
            }
            // list does multiple queries
            if(req.params.api.meta === 'list'){
                this.db.queryList(this.parseList(req.params.query, ','), function(docs){
                    callback(docs)
                })
            }
            else{
                this.handler(req.params.api.db, req.params.api.meta, req.params.query, function(docs){
                    callback(docs)
                })
            }
            break
            case 'POST':
            if(req.params.api.meta === 'stream' || req.params.api.meta === 'count' ){
                this.convertOptions(req.body)
            }

            if(req.params.api.meta === 'list'){
                this.db.queryList(req.body, function(docs){
                    callback(docs)
                })
            }
            else{
                this.handler(req.params.api.db, req.params.api.meta, req.body, function(docs){
                    callback(docs)
                })
            }
            break
            default:
            callback(null)
            break
        }
    }

    /**
     * publish the data to subscribed websocket and query the database to build the response
     * @param {string} path 
     * @param {string} meta 
     * @param {object} data 
     * @param {object} res 
     */
    handler(path, meta, data, callback){
        let p = this.options.path ? this.options.path + '/' + path : './' + path
        if(data){
            this.pubsub.handle( this.pubsub.convertMeta(meta) , data, null)
            this.db.query(p, meta, data, function(docs){
                callback(docs)
            })
        }
        else{
            callback(null)
        }
    }

    /**
     * Handle the db docs
     * @param {object} req 
     * @param {object} res 
     */
    handleDocs(req, res){
        if(req.docs){
        res.setHeader('Content-type','application/json' );
        if(!req.docs.err){
        res.statusCode = 200;
        }
        else{
        res.statusCode = 500;
        }
        }
    }

    /**
     * Loop each middleware and write the data to client
     * @param {object} req 
     * @param {object} res 
     */
    handleWriteEnd(req, res){
        // if response not alread fired
        if(!res.finished){
        if(res.statusCode === 200){
            res.write(Buffer.from(JSON.stringify(req.docs)));
            res.end()
        }
        else{
            res.end();
        }
        }
        
    }

    /**
     * Handles the multiple query async
     * @param {object} query 
     * @param {function} callback 
     */
    listDb(query, callback){
        let self = this
        let data = {}
        let ref = []
        async.forEach(query, function(element, next){
            self.handler(element.db, element.meta, element.data, function(docs){
                data[element.name] = docs
                next(docs.err)
            })
        }, function(err){
            callback(data)
        })
    }

    /**
     * Parses the query string to object when a multiplequery is emitted like /select/list?one=db,stream,limit 5,reverse true&two=db,get,key @mykey
     * to handle multiple queries
     * @param {object} list 
     * @param {string} delimiter 
     */
    parseList(list, delimiter){
        let data = []
        let tmp_data = []
        let tmp_meta = []
        let query = {}

        for(let i in list){
            tmp_data = list[i].split(delimiter)
            query = {
                name: i,
                db : '',
                meta: '',
                data: {}
            }
            query.db = tmp_data[0]
            query.meta = tmp_data[1]
            //parses the data like limit, key, reverse...
            for(let m = 2; m < tmp_data.length; m++){
                tmp_meta = tmp_data[m].split(/ (.+)/)
                if(Number(tmp_meta[1]))
                tmp_meta[1] = parseInt(tmp_meta[1])
                else if(tmp_meta[1] === 'true' || tmp_meta[1] === '1' || tmp_meta[1] === 'false' || tmp_meta[1] === '0')
                tmp_meta[1] = tmp_meta[1] === 'true' ? true : false
                query.data[tmp_meta[0]] = tmp_meta[1]
 
            }
            data.push(JSON.parse(JSON.stringify(query)))
        }

        return data
    }

    /**
     * parse the path into array
     * @param {string} path path of the url
     */
    parseParam(path){
        let prefix = typeof this.options.prefix !== 'undefined' ? this.options.prefix : '/api'
        let obj = {
            path: '',
            db : '',
            meta: ''
        }
        //split the api spart and the url part
        let pathtmp = path.split(prefix)
        obj.path = pathtmp[0]
        try{
            //if it has a api part parse db-name and action
            pathtmp =  pathtmp[1].split('/')
            obj.db = pathtmp[1]
            obj.meta = pathtmp[2]
        }
        catch(e){
        }
        if(this.options.log)
        console.debug(obj)

        return obj
    }

    /**
     * Parse the http-body
     * @param {object} req 
     * @param {function} callback 
     */
    createDataFromReq(req, callback){
        if(req.method !== 'GET'){
            var buffer = new Buffer.from('');
            req.on('data', chunk => {
                buffer = Buffer.concat([buffer, chunk]);
            });
            req.on('end', () => {
                try{
                    callback(JSON.parse(buffer.toString()));
                }
                catch(e){
                    callback({})
                }
            });
            }
        else{
            callback(null)
        }
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
}



module.exports = HttpServer
