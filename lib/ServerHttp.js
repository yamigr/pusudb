const http = require('http');
const url = require('url');
const parse = require('querystring').parse;
const EventEmitter = require('events').EventEmitter;
const async = require('async')

var helpers = require('./helpers')

class HttpServer extends EventEmitter {

    constructor(port, host, db, pubsub, middleware){
        super();
        this._host = host ? host : 'localhost'
        this._port = port ? port : 2222
        this._query
        this._param
        this._path
        this.db = db
        this.pubsub = pubsub
        this.sequence = Array.isArray(middleware) ? middleware : []
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
        async.parallel([

            //prepare the req.params with the query parameters
            //define a req.docs object to handle the database docs in middleware
            function(done){
                req.params = {}
                req.params = url.parse(req.url, true)
                //add the db-metas to the req object to handle it in a middleware
                req.meta = {}
                req.meta = self.db.meta
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
                req.docs = {}
                self.handelQuery(req, function(docs){
                    req.docs = docs
                    done()
                })
            }
        ], function(err){
            //loop async the middlewares
            async.forEachOfSeries(self.sequence, function(fn, index, next){
                try{
                    fn.call(self, req, res, function(err){
                        next(err)
                    })
                }
                catch(e){
                    throw new Error('handle middleware-function error:', e)
                }
            }, function(err){
                //if the response isn't finished by a middleware
                if(!err){
                    if(!res.finished){
                        self.sender(res, req.docs)
                    }
                }
                else{
                    if(!res.finished){
                        res.writeHead(500);
                        res.end();
                    }
                }
            })
        })

    }

    /** 
     * http request-callback
    */
    create(){
        return new http.createServer(this.middleware.bind(this))
    }

    /**
     * Final call
     * @param {object} req 
     * @param {object} res 
     */
    handelQuery(req, callback){
        this._path = this.parseParam(req.params.pathname)
        callback = helpers.callbackNoob(callback)

        switch(req.method){
            case 'GET':
            if(this._path.db === 'stream'){
                this.convertOptions(req.params.query)
            }
            this.handler(this._path.db, this._path.meta, req.params.query, function(docs){
                callback(docs)
            })
            break
            case 'POST':
            if(this._path.meta === 'stream'){
                this.convertOptions(req.body)
            }
            this.handler(this._path.db, this._path.meta, req.body, function(docs){
                callback(docs)
            })
            break
            case 'PUT':
            this.handler(this._path.db, 'update', req.body, function(docs){
                callback(docs)
            })
            break
            case 'DELETE':
            this.handler(this._path.db, 'del', req.body, function(docs){
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

    sender(res, docs){

        if(!docs){
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.write(Buffer.from(JSON.stringify({ error : 'method meta error'})));
            res.end();
        }
        else{
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write(Buffer.from(JSON.stringify(docs)));
            res.end();
        }
    }

    /**
     * parse the path into array
     * @param {string} path path of the url
     */
    parseParam(path){

        let obj = {
            db : '',
            meta: ''
        }

        try{
            let splitted = path.slice(1,path.length).split('/')
            obj = {
                db: splitted[splitted.length - 2],
                meta: splitted[splitted.length - 1]
            }
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

    }
}



module.exports = HttpServer
