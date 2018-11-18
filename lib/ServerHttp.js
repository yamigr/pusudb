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

    listen(callback){
        callback = helpers.callbackNoob(callback)
        let self = this

        this.use()
        this._server = this.create();
        
        this._server.listen(this._port, this._host, function(){
            callback(self._port, self._host)
        })
    }

    /** 
     * with use the server get all middleware functions and bind this to it, to get the req and res obj.
    */
    use(seq){
        this.sequence = helpers.bindMiddleware(this, seq)
    }

    useBefore(seq){
        this.sequenceBefore = helpers.bindMiddleware(this, seq)
    }

    /**
     * This method will be called on each request and handles the middleware in series.
     * First it parses the query params, the body if it has one and querie the database to add the docs to the request
     * After the parsing - in the middleware the params and the body can be used like req.body, req.params, req.docs
     * @param {object} req 
     * @param {object} res 
     */
    middleware(req, res){
        let self = this
        if(this.options.log)
        req.start = new Date().valueOf()
        async.series([
            //prepare the req.params with the query parameters
            //define a req.docs object to handle the database docs in middleware
            function(done){
                //parse the url query
                req.params = {}
                req.params = url.parse(req.url, true)
                req.params.api = {}
                //add the db-metas to the req object to handle it in a middleware
                req.meta = {}
                //get the meta action keys by database
                req.meta = self.db.meta
                // holds the content to send back to client
                req.content = '' 
                // parse the url parameter -> url, the pusudb object can be accessed in the middleware
                req.params.api = self.parseParam(req.params.pathname)
                done()
            },
            //parse body
            function(done){
                req.body = {}
                if(req.method !== 'GET'){
                self.createDataFromReq(req, function(body){
                    req.body = body
                    done()
                })
                }
                else{
                    done()
                }
            },

            // middleware that is invoked before a normal middleware and query
            // a before-middleware can be a auth- or schema-middleware,....
            function(done){
                helpers.asyncMiddleware(self, self.sequenceBefore, req, res, function(err, req, res){
                    done()
                })
            },

            //query the database and put the data to the request
            function(done){
                req.docs = { err: '', data : ''}
                if(req.params.api.db && req.params.api.meta){
                    try{
                        self.handelQuery(req, function(docs){
                            req.docs = docs
                            self.handleDocs(req, res);
                            done()
                        })
                    }
                    catch(e){
                        console.error(e)
                    }
                }
                else{
                    done()
                }

            }
        ], function(err){
            //loop async the middlewares
            self.handleWriteAndEnd(req,res)
        })

    }

    /** 
     * http request-callback
    */
    create(){
        return new http.createServer(this.middleware.bind(this))
    }

    /**
     * Query the db
     * @param {object} req 
     * @param {object} res 
     */
    handelQuery(req, callback){
        callback = helpers.callbackNoob(callback)

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
            case 'PUT':
            this.handler(req.params.api.db, 'update', req.body, function(docs){
                callback(docs)
            })
            break
            case 'DELETE':
            this.handler(req.params.api.db, 'del', req.body, function(docs){
                callback(docs)
            })
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
    }

    /**
     * Handle the db docs
     * @param {object} req 
     * @param {object} res 
     */
    handleDocs(req, res){
        res.setHeader('Content-type','application/json' );
        if(!req.docs){
        res.statusCode = 500;
        }
        else{
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
    handleWriteAndEnd(req, res){
        let self = this
        helpers.asyncMiddleware(this, this.sequence, req, res, function(err, req, res){
   
            if(self.options.log){
            let stop = new Date()
            console.debug(Date(), req.method, req.url, res.statusCode, stop.valueOf() - req.start + ' ms')
            }
            if(!err){
                if(!req.content && res.statusCode === 200){
                req.content = Buffer.from(JSON.stringify(req.docs))
                }

                if(!res.finished){
                res.write(req.content);
                res.end()
                }
            }
            else{
                if(!res.finished){
                res.writeHead(500);
                res.end();
                }
            }
        })

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
     * @param {object} request 
     * @param {function} callback 
     */
    createDataFromReq(request, callback){
        var buffer = new Buffer.from('');
        request.on('data', chunk => {
            buffer = Buffer.concat([buffer, chunk]);
        });
        request.on('end', () => {
            try{
                callback(JSON.parse(buffer.toString()));
            }
            catch(e){
                callback(null)
            }
        });
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
