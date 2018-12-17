/** 
 * Autor: yannick grund, 2018
 * This class implements the http-server in the pusudb
 * It parses the request, handle the custom middlewares and sending the response to the client
 * It's possible to add middlewares before or after the database-query
*/
const http = require('http');
const helpers = require('./helpers')
const async = require('async')
const assert = require('assert')
const Utility = require('./Utility')

class HttpServer extends Utility {

    constructor(port, host, pubsub, opt){
        super(opt, host, pubsub)
        this.options = typeof opt === 'object' ? opt : {}
        this._host = host
        this._port = port
        this.pubsub = pubsub
        this.sequence = []
        this.sequenceBefore = []
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
            this.start = new Date().valueOf()

        //prepare the req variables
        this.defineRequestProps(req, true)
        this.defineResponseProps(res)

        async.series([
            //parse body
            function(done){
                self.createDataFromReq(req, function(){
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
                if(self.hasPrefix(req.url) && !self.options.db_list.length || self.hasPrefix(req.url) && self.options.db_list.indexOf(req.params.api.noExtDb) !== -1){
                    self.handelQuery(req, function(err, docs){
                        req.docs = Object.assign(req.docs, { db : req.params.api.noExtDb, meta : req.params.api.meta } , docs)
                        if(docs){
                            res.setHeader('Content-type','application/json' );
                            res.statusCode = 200;
                        }
                        done(err)
                    })
                }
                else{
                    done()
                }
            },
            // middleware - invoked after the db-query
            function(done){
                helpers.asyncMiddleware(self, self.sequence, req, res, function(err, req, res){
                    done(err)
                })
            }
        ], function(err){
            // write the result and fire the response the err has the statuscode when error or 0 when ok
            self.handleWriteEnd(err, req, res)
            // log on console
            self.consoleLogger(self.start, 'HTTP', req.method + ', ' + req.params.pathname + ', ' + res.statusCode)
        })

    }

    /** 
     * create the server and bind all middlewares
    */
    create(){
        return new http.createServer(this.middleware.bind(this))
    }

    /**
     * Query the db
     * @param {object} req 
     * @param {function} callback return err, docs
     */
    handelQuery(req, callback){
        try{
            this.handleQueryCases(req, function(docs){
                callback(null, docs)
            })
        }
        catch(e){
            console.error(e)
            callback(e.toString(), null)
        }
    }

    /**
     * handle the query cases for each method
     * @param {object} req 
     * @param {function} callback return docs
     */
    handleQueryCases(req, callback){

        if(req.params.api.meta === 'stream' || req.params.api.meta === 'count' ){
            this.convertOptions(req.params.query)
        }

        switch(req.method){
            case 'GET':
            // parse list form get-query
            if(req.params.api.meta === 'list' && !req.params.query.hash){
                req.params.query = this.parseList(req.params.query, ',')
            }
            // parse filter params
            else if(req.params.api.meta === 'filter'){
                req.params.query = this.convertFilterParam(req.params.query)
            }

            this.handlerQueryAndPubSub(this.buildPackage(req.params.api.db, req.params.api.noExtDb, req.params.api.meta, req.params.query), function(docs){
                callback(docs)
            })
            break
            case 'POST':
            // parse filter body
            if(req.params.api.meta === 'filter'){
                req.body = this.convertFilterParam(req.body)
            }

            this.handlerQueryAndPubSub(this.buildPackage(req.params.api.db, req.params.api.noExtDb, req.params.api.meta, req.body), function(docs){
                callback(docs)
            })
            break
            default:
            callback(null)
            break
        }
    }


    /**
     * Loop each middleware and write the data to client
     * @param {object} req 
     * @param {object} res 
     */
    handleWriteEnd(errCode, req, res){
        // if response not alread fired
        if(!res.finished){
        if(res.statusCode === 200){
            res.write(Buffer.from(JSON.stringify(req.docs)));
            res.end()
        }
        else{
            if(!res.statusCode){
                res.statusCode = errCode ? errCode : 404
            }
            res.end();
        }
        }
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
     * Parse the http-body
     * @param {object} req 
     * @param {function} callback 
     */
    createDataFromReq(req, callback){
        let self = this
        if(req.method !== 'GET'){
            var buffer = new Buffer.from('');
            req.on('data', chunk => {
                buffer = Buffer.concat([buffer, chunk]);
            });
            req.on('end', () => {
               if(req.headers['content-type'] === 'application/json'){
                    req.body = self.bodyParseJson(buffer)
               }
               else if(req.headers['content-type'] === 'multipart/form-data'){
                    // ToDo: Parse buffer when file-upload
               }
               else{
                    req.body = self.bodyParseForm(buffer)
               }
               callback()

            });
            }
        else{
            callback(null)
        }
    }

    bodyParseJson(buffer){
        try{
            return JSON.parse(buffer.toString());
        }
        catch(e){
            return {}
        }
    }

    bodyParseForm(buffer){
        try{
            return parse(buffer.toString());
        }
        catch(e){
            return {}
        }
    }  



}



module.exports = HttpServer
