

var request = require('request');
var assert = require('assert');
var Pusudb = require('../lib/main')
var UseEjs = require('pusudb-use-ejs')
var UseStatic = require('pusudb-use-static-file')
var port = 3005
var host = 'localhost'
 

var data
var pusudb
var useStatic, useEjs

//request.post({url:'http://service.com/upload', form: {key:'value'}}, function(err,httpResponse,body){ /* ... */ })

describe('pusudb framework', function() {
    before(function () {
        pusudb = new Pusudb(port, host, { log: false, prefix: '/api', path : './database'})
        useStatic = new UseStatic(__dirname + '/static', ['/block2', /* blocked pathnames */], { prefix : '/static' }) 
        useEjs = new UseEjs(__dirname + '/render', ['/block1', /* blocked pathnames */], { prefix : '' }) 

        pusudb.use('http', useEjs.serve)
        pusudb.use('http', useStatic.serve)

    });

    describe('#GET API', function() {
        it('create pusudb', function(done) {
            pusudb.listen(function(p, h){
                assert.equal(port + host , p + h);
                done()
            })
        });

        it('http put', function(done) {
            request('http://'+ host + ':' + port + '/api/db/put?key=person:@key&value=Test', function (error, response, body) {
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

        it('http middleware', function(done){
            let usedMiddleware1 = false
            pusudb.use('http', function(req, res, next){
                if(!usedMiddleware1){
                    usedMiddleware1 = true
                    assert.equal(req.params.query.key, 'yamigr')
                    assert.equal(req.pusudb.db, 'db')
                    assert.equal(req.pusudb.meta, 'get')
                    assert.equal(req.docs.data.value, 'https://github.com/yamigr')
                    assert.notEqual(req.meta, null)
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
                    assert.equal(req.pusudb.db, 'db')
                    assert.equal(req.pusudb.meta, 'get')
                    assert.equal(typeof req.docs, 'undefined')
                    assert.notEqual(req.meta, null)
                    done()
                }
                next()
            })
            request('http://'+ host + ':' + port + '/api/db/get?key=yamigr');

        })

        it('http static html code 200', function(done){
            request('http://'+ host + ':' + port + '/static/index.html', function (error, response, body) {
                assert.equal(response.statusCode, '200')
                done()
            });
        })  

        it('http static html code 404', function(done){
            request('http://'+ host + ':' + port + '/statica/index.html', function (error, response, body) {
                assert.equal(response.statusCode, '404')
                done()
            });
        })  


        it('http ejs page code 200', function(done){
            request('http://'+ host + ':' + port + '/index/api/db/get?key=yamigr', function (error, response, body) {
                assert.notEqual(body.indexOf('https://github.com/yamigr'), -1)
                done()
            });
        })  

        
        it('http ejs page code 404', function(done){
            request('http://'+ host + ':' + port + '/other/api/db/get?key=yamigr', function (error, response, body) {
                assert.notEqual(body.indexOf('https://github.com/yamigr'), -1)
                done()
            });
        })  

    });

});
  