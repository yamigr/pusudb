# pusudb

> framework to create webservices or web-apps.

[![Build Status](https://travis-ci.org/yamigr/pusudb.svg?branch=master)](https://travis-ci.org/yamigr/pusudb)

The pusudb has a http-webserver to handle rest-requests and responses and a websocket-server to handle publishes and subscribtions. The data is stored in a key-value-storage. 
Normally the pusudb serves JSON-data, but it's possible to add own middlewares to extends the functionality.

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
  * [select multiple queries](#select)
  * [encoded-query](#encoded)
  * [subscribe](#subscribe)
  * [unsubscribe](#unsubscribe)
* [Author](#author)
* [License](#license)

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

/*
Pusudb(port, host, options)

Options
* log : BOOL - log some data in the console
* prefix: STRING - the prefix for the database-query
* path : main path where the database is located (relative or absolute)
* uniqueId : default : '@key'. is replaced by a unique key
*/
var pusudb = new Pusudb(3000, 'localhost', {  log: false, prefix: '/api', path : __dirname + '/../database', uniqueId : '--uid' })

pusudb.listen(function(port, host){
    console.log('pusudb listening:', port, host)
})
```

<a name="middleware"></a>

## Middleware

With a middleware it's possible to add own functionalities to the pusudb-framwork. To handle the request or response data, take a look at the node.js http documentation. To use data from one middleware to a later called middleware, add a new property to the request-object like req['my-new-prop'].

### Links
* [https://www.npmjs.com/package/pusudb-use-auth-jwt](pusudb-use-auth-jwt)
* [https://www.npmjs.com/package/pusudb-use-ejs](pusudb-use-ejs)
* [https://www.npmjs.com/package/pusudb-use-static-file](pusudb-use-static-file)

### HTTP before

Use a middleware before querying the database and the normal middlewares.

```js
pusudb.useBefore('http', function(req, res, next){
    console.log(req.headers) // HTTP-Header
    console.log(req.params) // HTTP parameters like pathname,..
    console.log(req.params.query) //GET Parameters
    console.log(req.body) // POST Body
    // do some header-checks or parse the req.body by a schema
     next() /* or res.writeHead(401) res.end(); direct in here*/
})
```

### HTTP

Use a middleware after the querying.

```js
pusudb.use('http', function(req, res, next){
    console.log(req.headers) // HTTP-Header
    console.log(req.params.query) //GET Parameters
    console.log(req.body) // POST Body
    console.log(req.docs) // Database result-object descriped in API
    
    // Additional query
    req.db.query('./db','get', { key : "user:abc"}, function(doc){
      if(doc.err)
        next(doc.err) /* or res.writeHead(500) res.end(); direct in here*/
      else
        next()
    })

})
```

### HTTP CORS requests

To implement the pusudb in a existing server-framework, the pusudb needs to allow CORS-requests.
This can be done with a middleware like the following example.

```js
pusudb.use('http', function(req, res, next){
  if(req.method === 'OPTIONS'){
    res.setHeader('access-control-allow-origin', req.headers.origin) // main host
    res.setHeader('access-control-allow-methods', req.method)
    res.setHeader('access-control-allow-headers', req.headers['access-control-request-headers'])
    res.end()
  }
  else{
    res.setHeader('access-control-allow-origin', '*')
    next()
  }
})
```

### Websocket

Use a middleware when a websocket is connecting.
```js
pusudb.useBefore('ws', function(req, socket, next){
    console.log(req.headers)
    next()
})
```

Use a middleware on each message.
```js
pusudb.use('ws', function(req, socket, next){
    console.log(req.headers)
    next()
})
```

<a name="api"></a>

## API

Example url 'http://localhost:3000/[api]/[database]/[meta]

* api - the prefix where the query-string beginns
* database - the name of the database
* meta - define the method

<a name="put"></a>

### PUT
To create unique-ids add '@key' or the defined uniqueId-key in the pusudb-options. 
```
GET
http://localhost:3000/api/db/put?key=person:@key&value=Peter Pan

POST
http://localhost:3000/api/db/put

body = {
  key : "person:@key",
  value : "Peter Pan"
}

Websocket
ws://localhost:3000/api/db
Write
{"meta":"put","data":{"key":"person:@key","value":"Peter Pan"}}
```
#### Result
```js
{
  "err": null,
  "data": "person:zCzm7e7XT"
}
```

<a name="get"></a>

### GET
```
GET
http://localhost:3000/api/db/get?key=person:CXpkhn-3T

POST
http://localhost:3000/api/db/get

body = {
  key : "person:CXpkhn-3T"
}

Websocket
ws://localhost:3000/api/db
Write
{"meta":"get","data":{"key":"person:CXpkhn-3T"}}
```
#### Result successful
```js
{
  "err": null,
  "data": {
    "key": "person:CXpkhn-3T",
    "value": "Peter Pan"
  }
}
```
#### Result when key not found
```js
{
  "err": "NotFoundError: Key not found in database [person:CX]",
  "data": {
    "key": "person:CX"
  }
}
```

<a name="batch"></a>

### BATCH
```
POST
http://localhost:3000/api/db/batch

body =  [
  {"type":"del","key":"father"},
  {"type":"put","key":"yamigr","value":"https://github.com/yamigr"},
  {"type":"put","key":"p:1","value":{"age":24,"avatar":"gomolo"}},
  {"type":"put","key":"p:2","value":{"age":19,"avatar":"azuzi"}}
]


Websocket
ws://localhost:3000/api/db
Write
{"meta":"batch","data": [
                          {"type":"del","key":"father"},
                          {"type":"put","key":"yamigr","value":"https://github.com/yamigr"},
                          {"type":"put","key":"p:1","value":{"age":24,"avatar":"gomolo"}},
                          {"type":"put","key":"p:2","value":{"age":19,"avatar":"azuzi"}}
                        ]
}
```
#### Result successful
```js
{
  "err": null,
  "data": 4
}
```

<a name="stream"></a>

### STREAM

Options: greater / less than (gt / lt), greater / less than and equal (gte / lte), limit (limit) and reverse (reverse)

```
GET all
http://localhost:3000/api/db/stream 

GET pagenation
http://localhost:3000/api/db/stream?gt='last-key-in-list'&limit=50

GET stream of persons
http://localhost:3000/api/db/stream?gte=person:&lte=person:~


POST
http://localhost:3000/api/db/stream

body = {
  gt : STRING | OBJECT
  lt : STRING | OBJECT
  gte : STRING | OBJECT
  lte : STRING | OBJECT
  reverse : BOOL
  limit : INTEGER
}


Websocket
ws://localhost:3000/api/db
Write
{"meta":"stream","data": { ..., stream-options, ... }}
```
#### Result successful
```js
{
  "err": null,
  "data": [
    {
      "key": "person:AEYC8Y785",
      "value": "Sarah"
    },
    {
      "key": "person:GLnw5e8If",
      "value": "Karina"
    },
    {
      "key": "person:HSar_qa4f",
      "value": "Jan"
    }
  ]
}
```

<a name="del"></a>

### DEL

```
GET
http://localhost:3000/api/db/del?key=person:HSar_qa4f

POST
http://localhost:3000/api/db/del

body = {
  key : "person:HSar_qa4f"
}

Websocket
ws://localhost:3000/api/db
Write
{"meta":"del","data":{"key":"person:HSar_qa4f"}}
```
#### Result
```js
{
  "err": null,
  "data": "person:HSar_qa4f"
}
```

<a name="update"></a>

### UPDATE

```
GET
http://localhost:3000/api/db/update?key=person:HSar_qa4f&value=NewName

POST
http://localhost:3000/api/db/update

body = {
  key : "person:HSar_qa4f",
  value: "NewName"
}

Websocket
ws://localhost:3000/api/db
Write
{"meta":"update","data":{"key":"person:HSar_qa4f","value":"NewName"}}
```
#### Result successful
```js
{
  "err": null,
  "data": {
    "key": "person:AEYC8Y785",
    "value": "NewName"
  }
}
```
#### Result when key doesn't exist
```js
{
  "err": "NotFoundError: Key not found in database [person:HSar_qa4f]",
  "data": {
    "key": "person:HSar_qa4f",
    "value": "NewName"
  }
}
```

<a name="count"></a>

### COUNT

Use the [stream-options](#stream) to count a specific stream or keep it empty to count all. 

```
GET
http://localhost:3000/api/db/count?<stream-options-query>

POST
http://localhost:3000/api/db/count

body = {
  <stream-options-body>
}

Websocket
ws://localhost:3000/api/db
Write
{"meta":"count","data":{ <stream-options-body> }}
```
#### Result successful
```js
{
  "err": null,
  "data": 9
}
```

<a name="filter"></a>

### FILTER

```
GET
http://localhost:3000/api/db/filter?value=Sue

POST
http://localhost:3000/api/db/filter

body = {
  value: "Sue"
}

Websocket
ws://localhost:3000/api/db
Write
{"meta":"filter","data":{"value":"Sue"}}
```
#### Result successful
```js
{
  "err": null,
  "data": [
    {
      "key": "person:9bAuxQVYw",
      "value": "Sue"
    }
  ]
}
```

<a name="select"></a>

### SELECT MULTIPLE QUERIES

Querying the pusudb multiple-times in one step with the keywords select/list. A base64-encoded JSON-object is supported too.

```
GET
http://localhost:3000/api/select/list?nav=db,stream,limit 5,gte person:,lte person:~&user=db,get,key person:AEYC8Y785

POST
http://localhost:3000/api/select/list

body = [
  { name: 'nav', db: 'db', meta: 'stream', data: { limit: 5, gte: 'person:', lte : 'person:~' } },
  { name: 'user', db: 'db', meta: 'get', data: { key: 'person:AEYC8Y785' } } 
]

Websocket
http://localhost:3000/api
{
   "meta": "list",
   "data": [
      {
         "name": "nav",
         "db": "db",
         "meta": "stream",
         "data": {
            "limit": 5,
            "gte": "person:",
            "lte": "person:~"
         }
      },
      {
         "name": "user",
         "db": "db",
         "meta": "get",
         "data": {
            "key": "person:AEYC8Y785"
         }
      }
   ]
}

```
<a name="encoded"></a>

### Encoded-query

Use keyword hash to define a encoded query in base64.

Generate base64-string:
* browser: use atob and btoa
* nodejs:
```js

//example
var jsonObject = {
  key : 'mykey',
  value: 'some-value' // or object
}
// create a encoded base64-string. escapeForUrl : bool to generate a get-query-friendly-string ;)
var encoded = pusudb.encodeJsonToBase64(jsonObject, escapeForUrl)
// decode the base64 to json
var decoded = pusudb.decodeBase64ToJson(encoded)
```

```
GET
http://localhost:3000/api/select/list?hash=W3sibmFtZSI6Im5hdiIsImRiIjoiZGIiLCJtZXRhIjoic3RyZWFtIiwiZGF0YSI6eyJsaW1pdCI6NSwiZ3RlIjoicGVyc29uOiIsImx0ZSI6InBlcnNvbjp%2BIn19LHsibmFtZSI6InVzZXIiLCJkYiI6ImRiIiwibWV0YSI6ImdldCIsImRhdGEiOnsia2V5IjoicGVyc29uOkFFWUM4WTc4NSJ9fV0%3D

or

http://localhost:3000/api/db/stream?hash=eyJndGUiOiJwZXJzb246IiwibHRlIjoicGVyc29uOn4ifQ==


POST
http://localhost:3000/api/select/list

body = {
  hash : 'W3sibmFtZSI6Im5hdiIsImRiIjoiZGIiLCJtZXRhIjoic3RyZWFtIiwiZGF0YSI6eyJsaW1pdCI6NSwiZ3RlIjoicGVyc29uOiIsImx0ZSI6InBlcnNvbjp+In19LHsibmFtZSI6InVzZXIiLCJkYiI6ImRiIiwibWV0YSI6ImdldCIsImRhdGEiOnsia2V5IjoicGVyc29uOkFFWUM4WTc4NSJ9fV0='
}

Websocket
http://localhost:3000/api
{
   "meta": "list",
   "data": {
     "hash": "W3sibmFtZSI6Im5hdiIsImRiIjoiZGIiLCJtZXRhIjoic3RyZWFtIiwiZGF0YSI6eyJsaW1pdCI6NSwiZ3RlIjoicGVyc29uOiIsImx0ZSI6InBlcnNvbjp         +In19LHsibmFtZSI6InVzZXIiLCJkYiI6ImRiIiwibWV0YSI6ImdldCIsImRhdGEiOnsia2V5IjoicGVyc29uOkFFWUM4WTc4NSJ9fV0="
   }
}

```

<a name="subscribe"></a>

### SUBSCRIBE

The data can be a STRING or ARRAY to subscribe multiple keys. When a client put or update the value, the subscribed clients receives the actual data.

Wildcard: '#'

```
Websocket
ws://localhost:3000/api/db
Write
{"meta":"subscribe","data":"chat:9bAuxQVYw"}

{"meta":"subscribe","data":"chat:#"}
```
#### Message when someone put or update the entry
```js
{
  "err": null,
  "data": {
    "key": "chat:9bAuxQVYw",
    "value": "Aloah Joe!"
  }
}
```

<a name="unsubscribe"></a>

### UNSUBSCRIBE

The data can be a STRING or ARRAY to subscribe multiple keys. When the websocket connection is closed, the key will unsubscribe automatically.

```
Websocket
ws://localhost:3000/api/db
Write
{"meta":"unsubscribe","data":"chat:9bAuxQVYw"}
```

<a name="authors"></a>

## Authors

* **Yannick Grund** - *Initial work* - [yamigr](https://github.com/yamigr)

<a name="license"></a>

## License

This project is licensed under the MIT License

