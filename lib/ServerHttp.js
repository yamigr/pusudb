const http = require('http');
const url = require('url');
const parse = require('querystring').parse;
const EventEmitter = require('events').EventEmitter;
const async = require('async')
var path = require('path')
var helpers = require('./helpers')

class HttpServer extends EventEmitter {

    constructor(port, host, db, pubsub, middleware, opt){
        super();
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222
        this.db = db
        this.pubsub = pubsub
        this.sequence = Array.isArray(middleware) ? middleware : []
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
    use(){
        this.sequence = helpers.bindMiddleware(this, this.sequence)
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

        async.parallel([
            //prepare the req.params with the query parameters
            //define a req.docs object to handle the database docs in middleware
            function(done){
                req.params = {}
                req.params = url.parse(req.url, true)
                //add the db-metas to the req object to handle it in a middleware
                req.meta = {}
                req.meta = self.db.meta
                req.content = '' // holds the content to send back to client
                req.pusudb = self.parseParam(req.params.pathname)
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
            //query the database and put the data to the request
            function(done){
                req.docs = { err: '', data : ''}
                if(req.pusudb.meta){
                    self.handelQuery(req, function(docs){
                        req.docs = docs
                        self.handleDocs(req, res);
                        done()
                    })
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
            if(req.pusudb.meta === 'stream'){
                this.convertOptions(req.params.query)
            }
            this.handler(req.pusudb.db, req.pusudb.meta, req.params.query, function(docs){
                callback(docs)
            })
            break
            case 'POST':
            if(req.pusudb.meta === 'stream'){
                this.convertOptions(req.body)
            }
            this.handler(req.pusudb.db, req.pusudb.meta, req.body, function(docs){
                callback(docs)
            })
            break
            case 'PUT':
            this.handler(req.pusudb.db, 'update', req.body, function(docs){
                callback(docs)
            })
            break
            case 'DELETE':
            this.handler(req.pusudb.db, 'del', req.body, function(docs){
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
        this.pubsub.handle( this.pubsub.convertMeta(meta) , data, null)
        this.db.query('./' + path, meta, data, function(docs){
            callback(docs)
        })
    }

    /**
     * Handle the db docs
     * @param {object} req 
     * @param {object} res 
     */
    handleDocs(req, res){
        if(!req.docs){
            res.statusCode = 500;
            res.setHeader('Content-type','application/json' );
        }
        else{
            if(!req.docs.err){
                res.statusCode = 200;
            }
            else{
                res.statusCode = 500;
            }

            res.setHeader('Content-type','application/json' );
        }
    }

    /**
     * Loop each middleware and write the data to client
     * @param {object} req 
     * @param {object} res 
     */
    handleWriteAndEnd(req, res){
        let self = this
        async.forEach(this.sequence, function(fn, next){
                try{
                    fn.call(self, req, res, function(err){
                        next(err)
                    })
                }
                catch(e){
                    throw new Error('handle middleware-function error:', e)
                }
            }, function(err){
                if(self.options.log){
                    let stop = new Date()
                    console.log(Date(), req.method, req.url, res.statusCode, stop.valueOf() - req.start + ' ms')
                }
        
                if(!err){

                    if(!req.content)
                        req.content = Buffer.from(JSON.stringify(req.docs))

             
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
     * parse the path into array
     * @param {string} path path of the url
     */
    parseParam(path){
        let prefix = this.options.prefix ? this.options.prefix : '/api'

        let obj = {
            path: '',
            db : '',
            meta: ''
        }

        obj.path = path.split(this.options.prefix)[0]

        try{
            obj.db = path.split(this.options.prefix)[1].split('/')[1]
            obj.meta = path.split(this.options.prefix)[1].split('/')[2]
        }
        catch(e){
        }

        return obj
    }

    /**
     * Parse the http-body
     * @param {object} request 
     * @param {function} callback 
     */
    createDataFromReq(request, callback){
        var buffer = new Buffer('');
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
