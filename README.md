# pusudb

> pusudb is a database-framework to query the included key-value-storage by webservices or webpages.

The pusudb has a build-in http- and a websocket-server. 
With the http-server it's possible to query the pusudb with a request-response-pattern like REST.
With the websocket-server the pusudb can additionally serve a publish-subscribe-pattern. 
When a ws-client subscribe a key and another client put or update the certain value by http or ws, 
all subscribed ws-client receives the actual data.

* [Installing](#installing)
* [Server](#server)
* [Middleware](#middleware)
* [API](#api)
  * [put](#put)
  * [get](#get)
  * [batch](#batch)
  * [stream](#stream)
  * [del](#del)
  * [update](#update)
  * [count](#count)
  * [filter](#filter)
  * [subscribe](#subscribe)
  * [unsubscribe](#unsubscribe)
* [Author](#author)


<a name="installing"></a>
## Installing

```sh
npm install pusudb --save
```

<a name="server"></a>
## Server

```js
var Pusudb = require('pusudb')

var port = 3000
var host = 'localhost'

var pusudb = new Pusudb(port, host)

pusudb.listen(function(port, host){
    console.log('pusudb listening:', port, host)
})
```

<a name="middleware"></a>

## Middleware

It's possible to add custom middlewares. These can be defined for each protocol and will be called in series.

**A middleware needs to be declared before the pusudb starts listening.**

It's possible to query the pusudb in the middleware.

### HTTP
```js
pusudb.use('http', function(req, res, next){
    console.log(req.headers)
    console.log(req.params.query)
    console.log(req.body)

    this.db.query('./db','get', { key : "user:abc"}, function(doc){
      if(doc.err)
        next(doc.err) /* or res.writeHead(500) res.end(); direct in here*/
      else
        next()
    })

})
```

### Websocket
```js
pusudb.use('ws', function(req, socket, next){
    console.log(req.headers)
    next()
})
```


<a name="api"></a>

## API

The 'db' represents the database. It's possible to create different databases. When a 
database doesn't exist, the pusudb will create one.

<a name="put"></a>

### PUT

When a key has a '@key' in it, the pusudb will create a unique-id. With this options, it's possible to
create dynamic-key for the certain usage. 

#### HTTP
```
GET
localhost:3000/db/put?key=person:@key&value=Peter Pan

POST
localhost:3000/db/put

body = {
  key : "person:@key",
  value : "Peter Pan"
}
```

#### Websocket
```
Open connection
ws://localhost:3000/db

Emit
{"meta":"put","data":}

body = {
  key : "person:@key",
  value : "Peter Pan"
}
```
Result
```js
{
  "err": null,
  "data": "person:CXpkhn-3T"
}
```

### GET

```
GET
localhost:3000/db/get?key=person:CXpkhn-3T

POST
localhost:3000/db/get

body = {
  key : "person:CXpkhn-3T"
}
```
Result successful
```js
{
  "err": null,
  "data": {
    "key": "person:CXpkhn-3T",
    "value": "Peter Pan"
  }
}
```
Result key not found
```js
{
  "err": "NotFoundError: Key not found in database [person:CX]",
  "data": {
    "key": "person:CX"
  }
}
```


### Example request and response

The api can be tested with Postman or any websocket-addon in the browser.

```
HTTP

GET
URL: http://localhost:3000/db/get?key=person:inMdrWPDv
Response: {
            "err": null,
            "data": {
              "key": "person:inMdrWPDv",
              "value": "yamigr"
            }
          }
PUT
URL: http://localhost:3000/db/put?key=person:inMdrWPDv&value=
Response: {
            "err": null,
            "data": "person:1tebPQmmm"
          }
-> same response when successful deleting with del
-> or send the data with the method POST


Websocket

GET
URL: ws://localhost:3000/db
JSON-body: {"meta":"get","data":{"key":"person:inMdrWPDv"}}
Response: {
            "err": null,
            "data": {
              "key": "person:inMdrWPDv",
              "value": "yamigr"
            }
          }


SUBSCRIBE
URL: ws://localhost:3000/db
JSON-body: {"meta":"subscribe","data":"person:inMdrWPDv"}
Response: none
Message : {
            "err": null,
            "data": {
              "key": "person:inMdrWPDv",
              "value": "new name"
            }
          }



```

API Examples: [tcpleveldb](https://www.npmjs.com/package/tcpleveldb)

### HTTP
* url : http://localhost:3000/'db'/'meta'
* db : name of the database
* meta and query or post-data:
    * get (GET- or POST-request) => http://localhost:3000/'db'/get?key='key' or { key : '' } 
    * put (GET- or POST-request) => http://localhost:3000/'db'/put?key='key'&value='value' or { key : '', value : '' } 
    * del (GET- or POST-request) => http://localhost:3000/'db'/del?key='key'' or { key : '' } 
    * batch (POST-request) => [{type : 'put' , key : 'some_key', value : 'ok' },{},{}]
    * stream (POST-request) => { gte : '', lte : '', limit : 100, reverse : true, ... } or {} for get all
    * filter (POST-request) => STRING or OBJECT with the value to filter
    * update (POST-request)  => { key : '', value : '' }

### Websockets
* url : ws://localhost:3000/'db'
* db : name of the database
* data-body: { meta : '', data : ''}
* meta and body-data:
    * get => { key : '' }
    * put => { key : '', value : '' }
    * del => { key : '' }
    * batch => [{type : 'put' , key : 'some_key', value : 'ok' },{},{}]
    * stream => { gte : '', lte : '', limit : 100, reverse : true, ... } or {} for get all
    * filter  => STRING or OBJECT with the value to filter
    * update  => { key : '', value : '' }
    * subscribe => key or [ key, ...,...]
    * unsubscribe => key or [ key, ...,...]

### JSON-Response
```js

// single result
{
  "err": null,
  "data": {
    "key": "obj:2",
    "value": {
      "a": 1,
      "b": "xyz",
      "c": "Hello World!"
    }
  }
}


// multiple results
{
  "err": null,
  "data": [
    {
      "key": "obj:1",
      "value": {
        "a": 123,
        "b": "abc",
        "c": "Hello World!"
      }
    },
    {
      "key": "obj:2",
      "value": {
        "a": 1,
        "b": "xyz",
        "c": "Hello World!"
      }
    }
  ]
}
```

## Authors

* **Yannick Grund** - *Initial work* - [yamigr](https://github.com/yamigr)


## License

This project is licensed under the MIT License

