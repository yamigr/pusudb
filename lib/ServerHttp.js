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
        this._server = this.create();
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
        this._server.listen(this._port, this._host, function(){
            callback(self._port, self._host)
        })
    }

    /** 
     * with use the server get all middleware functions and bind this to it, to get the req and res obj.
    */
    use(){
        let binded = []
        for(let fn in this.sequence){
            if(typeof this.sequence[fn] !== 'function'){
                throw new Error('Middleware is not a function')
            }
            else{
                binded.push(this.sequence[fn].bind(this))
            }
        }
        this.sequence = binded
    }

    /**
     * This method will be called on each request and handles the middleware in series.
     * First it parses the query params and the body if it has one
     * After the parsing - in the middleware the params and the body can be used like req.body, req.params
     * @param {object} req 
     * @param {object} res 
     */
    middleware(req, res){
        let self = this
        async.parallel([
            function(done){
                req.params = {}
                req.params = url.parse(req.url, true)
                done()
            },
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
            }
        ], function(err){
            async.forEachOfSeries(self.sequence, function(fn, index, next){
                fn.call(self, req, res, function(err){
                    next(err)
                })
            }, function(err){
                if(!err){
                    self.handelReqRes(req, res)
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
        this.use()
        return new http.createServer(this.middleware.bind(this))
    }

    /**
     * Final call
     * @param {object} req 
     * @param {object} res 
     */
    handelReqRes(req, res){
        this._path = this.parseParam(req.params.pathname)

        switch(req.method){
            case 'GET':
            if(this._path[1] === 'stream'){
                this.convertOptions(req.params.query)
            }
            this.handler(this._path[0], this._path[1], req.params.query, res)
            break
            case 'POST':
            if(this._path[1] === 'stream'){
                this.convertOptions(req.body)
            }
            this.handler(this._path[0], this._path[1], req.body, res)
            break
            case 'PUT':
            this.handler(this._path[0], 'update', req.body, res)
            break
            case 'DELETE':
            this.handler(this._path[0], 'del', req.body, res)  
            break
            default:
            res.writeHead(500, {'Content-Type': 'application/json'});
            res.write(Buffer.from(JSON.stringify({ error : 'method error'})));
            res.end();
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
    handler(path, meta, data, res){
        this.db.query('./' + path, meta, data, function(docs){
            res.writeHead(200, {'Content-Type': 'application/json'});
            res.write(Buffer.from(JSON.stringify(docs)));
            res.end();
        })
        meta = this.pubsub.convertMeta(meta)
        this.pubsub.handle(meta, data, null)
    }

    /**
     * parse the path into array
     * @param {string} path path of the url
     */
    parseParam(path){
        return (path.length < 2 ) ? null : path.slice(1,path.length).split('/')
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
        if(opt.limit){
            opt.limit = parseInt(opt.limit)
        }
        if(opt.reverse){
            opt.revers = opt.revers === 'true' ? true : false
        }
    }
}



module.exports = HttpServer
