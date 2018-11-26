

var request = require('request');
var assert = require('assert');
var Pusudb = require('../lib/main')
var UseEjs = require('pusudb-use-ejs')
var UseStatic = require('pusudb-use-static-file')
var Websocket = require('ws')
var port = 3005
var host = 'localhost'
var prefix = '/api'
 
var data
var pusudb
var useStatic, useEjs
var wsIsOpen = false
var wsData
var ws
var wsMiddleware = null
var wsMiddlwareDb = null
var uid = '==bla=='
pusudb = new Pusudb(port, host, { log: false, prefix: '/api', path : '', uniqueId : uid })
useStatic = new UseStatic(__dirname + '/static', ['/block2', /* blocked pathnames */], { prefix : '/static' }) 
useEjs = new UseEjs(__dirname + '/render', ['/block1', /* blocked pathnames */], { prefix : '' }) 

describe('pusudb http', function() {
    before(function () {
        pusudb.use('http', useEjs.serve)
        pusudb.use('http', useStatic.serve)

        pusudb.useConnect('ws', function(req, ws, next){
            console.log('connected')
            console.log(req.headers)
            console.log(req.params) // URL params
            next()
        })

        pusudb.useBefore('ws', function(req, ws, next){
            wsMiddleware = req.headers
            wsMiddlwareDb = req.db
            next()
        })
    });

    after( function(){
        process.exit()
    })

    describe('#GET API', function() {
        it('create pusudb', function(done) {
            pusudb.listen(function(p, h){
                assert.equal(port + host , p + h);

                ws = new Websocket('ws://' + host + ':' + port + prefix);
                ws.on('open', function open() {
                    wsIsOpen = true
                });
                
                ws.on('message', function incoming(data) {
                    wsData = JSON.parse(data)
                });
                done()
            })
        });

        it('http put', function(done) {
            request('http://'+ host + ':' + port + '/api/db/put?key=person:' + uid + '&value=Test', function (error, response, body) {
                data = JSON.parse(body)
                done(data.err)
            });
        });

        it('http get', function(done) {
            request('http://'+ host + ':' + port + '/api/db/get?key=' + data.data, function (error, response, body) {
                data = JSON.parse(body)
                assert.equal(data.data.value, 'Test')
                done(data.err)
            });
        });

        it('http del', function(done) {
            let key = data.data.key
            request('http://'+ host + ':' + port + '/api/db/del?key=' + key, function (error, response, body) {
                data = JSON.parse(body)
                assert.equal(data.data, key)
                done(data.err)
            });
        });

        
        it('http batch post', function(done) {
            data =  [
                {type:"del",key:"father"},
                {type:"put",key:"yamigr",value:"https://github.com/yamigr"},
                {type:"put",key:"ya:1",value:"wayne's"},
                {type:"put",key:"ya:2",value:"world"},
                {type:"put",key:"p:1",value:{age:24,avatar:"gomolo"}},
                {type:"put",key:"p:2",value:{age:19,avatar:"azuzi"}}
              ]
            request.post({url:'http://'+ host + ':' + port + '/api/db/batch',     
                            json: data}, 
                            function(err,httpResponse,body){ 
                                assert.equal(body.data, Object.keys(data).length.toString())
                                done(err)
                            })

        });

        it('http stream', function(done) {
            request('http://'+ host + ':' + port + '/api/db/stream?limit=2', function (err, response, body) {
                body = JSON.parse(body)
                assert.equal(body.data.length, 2)
                done(err)
            });
        });

        it('http filter', function(done) {
            request('http://'+ host + ':' + port + '/api/db/filter?value=https://github.com/yamigr', function (err, response, body) {
                body = JSON.parse(body)
                assert.equal(body.data.length, 1)
                done(err)
            });
        });

        it('http update post', function(done) {
            jsonData = { key : 'p:1', value: {avatar:"jackass"}}

            request.post({url:'http://'+ host + ':' + port + '/api/db/update',     
                            json: jsonData}, 
                            function(err,httpResponse,body){ 
                                request('http://'+ host + ':' + port + '/api/db/get?key=' + jsonData.key, function (error, response, body) {
                                    data = JSON.parse(body)
                                    assert.strictEqual(data.data.value.avatar, jsonData.value.avatar)
                                    done(data.err)
                                });
                            })

        });

        it('http count', function(done) {
            request('http://'+ host + ':' + port + '/api/db/count?gte=p:&lte=p:~', function (err, response, body) {
                body = JSON.parse(body)
                assert.equal(body.data, '2')
                done(err)
            });
        });


        it('http middleware', function(done){
            let usedMiddleware1 = false
            pusudb.use('http', function(req, res, next){
                if(!usedMiddleware1){
                    usedMiddleware1 = true
                    assert.equal(req.params.query.key, 'yamigr')
                    assert.equal(req.params.api.db, './db')
                    assert.equal(req.params.api.meta, 'get')
                    assert.equal(req.docs.data.value, 'https://github.com/yamigr')
                    assert.notEqual(req.meta, null)
                    assert.notEqual(req.db, null)
                    done()
                }
                next()
            })
            request('http://'+ host + ':' + port + '/api/db/get?key=yamigr');

        })

        it('http middleware-before', function(done){
            let usedMiddleware2 = false
            pusudb.useBefore('http', function(req, res, next){
                if(!usedMiddleware2){
                    usedMiddleware2 = true
                    assert.equal(req.params.query.key, 'yamigr')
                    assert.equal(req.params.api.db, './db')
                    assert.equal(req.params.api.meta, 'get')
                    assert.equal(req.docs.data, '')
                    assert.notEqual(req.meta, null)
                    done()
                }
                next()
            })
            request('http://'+ host + ':' + port + '/api/db/get?key=yamigr');

        })

        it('http static page root as index = /', function(done){
            request('http://'+ host + ':' + port + '/static' , function (error, response, body) {
                assert.notEqual(body.indexOf('<!DOCTYPE html>'), -1)
                done()
            });
        })  

        it('http static html code 200', function(done){
            request('http://'+ host + ':' + port + '/static/index.html', function (error, response, body) {
                assert.equal(response.statusCode, 200)
                assert.notEqual(body.indexOf('<!DOCTYPE html>'), -1)
                done()
            });
        })  

        it('http static html code 404', function(done){
            request('http://'+ host + ':' + port + '/statica/index.html', function (error, response, body) {
                assert.equal(response.statusCode, 404)
                done()
            });
        })  


        it('http ejs page root as index = /', function(done){
            request('http://'+ host + ':' + port , function (error, response, body) {
                assert.notEqual(body.indexOf('<!DOCTYPE html>'), -1)
                done()
            });
        })  

        it('http ejs page code 200', function(done){
            request('http://'+ host + ':' + port + '/index/api/db/get?key=yamigr', function (error, response, body) {
                assert.notEqual(body.indexOf('https://github.com/yamigr'), -1)
                assert.notEqual(body.indexOf('<!DOCTYPE html>'), -1)
                done()
            });
        })  

        
        it('http ejs page code 404', function(done){
            request('http://'+ host + ':' + port + '/other/api/db/get?key=yamigr', function (error, response, body) {
                assert.equal(response.statusCode, 404)
                done()
            });
        })  

    });

    describe('pusudb websocket', function() {

        it('websocket middleware', function(done){
            let usedMiddleware3 = false
            setTimeout(function(){
                try{
                ws.send(JSON.stringify({"db":"db","meta":"put","data":{"key":"person:wsTest", "value":"Hello Test!"}}));
                } catch (e) {
                /* handle error */
                console.error(e)
                }

            },500)

            setTimeout(function(){
                wsMiddlwareDb
                assert.notEqual(wsMiddlwareDb , null)
                assert.equal(wsMiddleware['sec-websocket-version'] , 13)
                done()
            },750)
        })


        it('websocket put', function(done){
            try {
            ws.send(JSON.stringify({"db":"db","meta":"put","data":{"key":"person:wsTest", "value":"Hello Test!"}}));
            } catch (e) {
            /* handle error */
            console.error(e)
            }

            setTimeout(function(){
                assert.equal(wsData.data, 'person:wsTest')
                done()
            },50)
        })  

        it('websocket get', function(done){
                try {
                ws.send(JSON.stringify({"db":"db","meta":"get","data":{"key":"person:wsTest"}}));
                } catch (e) {
                /* handle error */
                console.error(e)
                }
    
                setTimeout(function(){
                    assert.equal(wsData.data.value, 'Hello Test!')
                    done()
                },50)
        })  

        it('websocket subscribe', function(done){
                try {
                ws.send(JSON.stringify({"db":"db","meta":"subscribe","data":"person:wsTest"}));
                } catch (e) {
                /* handle error */
                console.error(e)
                }
    
                setTimeout(function(){
                    assert.equal(wsData.data, 'subscribed')
                    done()
                },50)
        })  

        it('websocket publish', function(done){
                request('http://'+ host + ':' + port + '/api/db/update?key=person:wsTest&value=new message');
                setTimeout(function(){
                    assert.equal(wsData.data.value, 'new message')
                    ws.send(JSON.stringify({"db":"db","meta":"unsubscribe","data":"person:wsTest"}));
                    done()
                },50)
        })

        it('websocket subscribe wildcard', function(done){
            try {
            ws.send(JSON.stringify({"db":"db","meta":"subscribe","data":"ya:#"}));
            } catch (e) {
            /* handle error */
            console.error(e)
            }

            setTimeout(function(){
                assert.equal(wsData.data, 'subscribed')
                done()
            },50)
        })  

        it('websocket publish wildcard', function(done){
                request('http://'+ host + ':' + port + '/api/db/update?key=ya:1&value=new message');
                setTimeout(function(){
                    assert.equal(wsData.data.value, 'new message')
                    ws.send(JSON.stringify({"db":"db","meta":"unsubscribe","data":"ya:#"}));
                    done()
                },50)
        })


        it('websocket unsubscribed check', function(done){
            wsData = null
            request('http://'+ host + ':' + port + '/api/db/update?key=person:wsTest&value=bla');
            setTimeout(function(){
                assert.strictEqual(wsData, null)
                done()
            },50)
        })

        it('websocket unsubscribed wildcard check', function(done){
            wsData = null
            request('http://'+ host + ':' + port + '/api/db/update?key=ya:1&value=party time excellent');
            setTimeout(function(){
                assert.strictEqual(wsData, null)
                done()
            },50)
        })

        it('websocket wrong meta', function(done){
            try {
                ws.send(JSON.stringify({"db":"db","meta":"blabla","data":"ya:#"}));
                } catch (e) {
                /* handle error */
                console.error(e)
                }
    
                setTimeout(function(){
                    assert.equal(wsData.err, 'query not exist.')
                    done()
                },50)
        })

        it('websocket Unexpected token', function(done){
            try {
                ws.send('blabla');
                } catch (e) {
                /* handle error */
                console.error(e)
                }
    
                setTimeout(function(){
                    assert.equal(wsData.err, 'SyntaxError: Unexpected token b in JSON at position 0')
                    done()
                },50)
        })

        
        it('websocket empty data', function(done){
            try {
                ws.send(JSON.stringify({}));
                } catch (e) {
                /* handle error */
                console.error(e)
                }
    
                setTimeout(function(){
                    assert.equal(wsData.err, 'query not exist.')
                    done()
                },50)
        })
    })
});
  