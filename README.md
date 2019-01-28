# pusudb

> framework to build web- and micro-services.

[![Build Status](https://travis-ci.org/yamigr/pusudb.svg?branch=master)](https://travis-ci.org/yamigr/pusudb)

The pusudb has a http-webserver to handle rest-requests and responses and a websocket-server to handle publishes and subscriptions. The data is stored in a key-value-storage. 
Normally the pusudb serves JSON-data, but it's possible to add own middlewares to extends the functionality.

<a name="top"></a>

* [Installing](#installing)
* [Server](#server)
* [Middleware](#middleware)
* [Add-on](#addon)
* [API](#api)
  * [put](#put)
  * [get](#get)
  * [batch](#batch)
  * [stream](#stream)
  * [keys](#keys)
  * [values](#values)
  * [del](#del)
  * [update](#update)
  * [count](#count)
  * [filter](#filter)
  * [multiple queries](#select)
  * [encoded-query](#encoded)
  * [subscribe](#subscribe)
  * [unsubscribe](#unsubscribe)
  * [publish](#publish)
* [Authors](#authors)
* [License](#license)

<a name="installing"></a>
## Installing

```sh
npm install pusudb --save
```
<a name="server"></a>

## Server
For debuging it has the env-variables 'pusudb:http', 'pusudb:ws' and 'pusudb:pubsub'. Check package [debug](https://www.npmjs.com/package/debug) for more informations. (os ms like $Env:DEBUG="pusudb"; or $Env:DEBUG=""; )

```js
var Pusudb = require('pusudb')

var port = 3000
var host = 'localhost'

/*
Pusudb(port, host, options)

Options
* prefix: STRING - default '/api' url-prefix
* path : STRING - database path (relative or absolute)
* uniqueId : STRING - default : '@key' convert into a uniqueId by pusudb
* db_port: NUMBER - default pusudb-port + 1
* db_list: ARRAY - default [] - no limitation of databases
* db_block: ARRAY - default [] - define some db's which can not be accessed from public, like the user-db
* ws_active: BOOL - default true -> enable / disable websocket
* heartbeat: INTEGER - default 30000ms -> ping pong event for ws. If 0 -> not active
* http_active: BOOL - default true -> enable / disable http-server
*/
var pusudb = new Pusudb(3000, 'localhost', { prefix: '/api', path : __dirname + '/../database', uniqueId : '--uid', db_list : ['db'] })

pusudb.listen(function(port, host){
    console.log('pusudb listening:', port, host)
})
```

<a name="middleware"></a>

## Middleware
[[Back To Top]](#top)

With a middleware it's possible to add own functionalities to the pusudb-framework. To handle the request or response data, take a look at the node.js http documentation. For websocket the package ws. To use data from one middleware to a later called middleware, add a new property to the request-object like req['my-new-prop']. 
Reserved props are :
* req.params - request parameters
* req.body - request body
* req.meta - database metas
* req.docs - database result { err : '', data : ...}
* req.render - object to add rendering data for the ejs-middleware
* req.user - user if auth is active
* req.db - instance to query the database inside a middleware
* req.pubsub - instance to publish or subscribe data

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
    console.log(req.render) // Add props to render to access the oject in the ejs-middleware
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
    console.log(req.render) // Add props to render to access the oject in the ejs-middleware
    console.log(req.user) // User if auth is active
    // call next() to jump into next middleware

    // Additional query
    req.db.query('./db','get', { key : "news:20181222"}, function(doc){
      if(doc.err)
        next(doc.err) /* or res.writeHead(500) res.end(); direct in here*/
      else
        next() // Yees, all ok
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

Use middleware when a websocket is connecting.

```js
pusudb.useConnect('ws', function(req, socket, next){
    // Same req-props described above
    // Call next() to jump into next middleware
    // Additional query
    req.db.query('./db','get', { key : "user:abc"}, function(doc){
      if(doc.err)
        next(doc.err) /* or socket.send( string || buffer) */
      else
        next()
    })
})
```

Use middlware before querying the pusudb.

```js
pusudb.useBefore('ws', function(req, socket, next){
    console.log(req.headers)
    console.log(req.params)

    // Additional query
    req.db.query('./db','get', { key : "user:abc"}, function(doc){
      if(doc.err)
        next(doc.err) /* or socket.send( string || buffer) */
      else
        next()
    })
})
```

Use middlware after querying.

```js
pusudb.use('ws', function(req, socket, next){
    console.log(req.headers) 
    console.log(req.params) // URL params
    console.log(req.body) // Body-Data
    console.log(req.docs) // Result sending to client 
    next()
})
```
<a name="addon"></a>

## Add-on
[[Back To Top]](#top)

List of pusudb-addons.

### Links
* [https://www.npmjs.com/package/pusudb-connector](pusudb-connector)
* [https://www.npmjs.com/package/run-sass](run-sass)

<a name="api"></a>

## API
[[Back To Top]](#top)

Example url 
* GET and POST 'http://localhost:3000/[api]/[database]/[meta]
* Websocket 'ws://localhost:3000/[api]'

Details
* api - prefix for the query-string
* database - the name of the database, only http
* meta - define the querying-method, only http

<a name="put"></a>

### PUT
[[Back To Top]](#top)

To create unique-ids add '@key' or the defined uniqueId-key at the pusudb-options. If posted by form and no value and key property existing, then the body is the value and a uniqueId will defined by pusudb. But if a key-prop exists, then it will copied to key and the other props will be copied to value.
```
GET
http://localhost:3000/api/db/put?key=person:@key&value=Peter Pan

POST JSON and FORM
http://localhost:3000/api/db/put

body = {
  key : "person:@key",
  value : "Peter Pan"
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"put","data":{"key":"person:@key","value":"Peter Pan"}}
```
#### Result
```js
{
  "err": null,
  "db": "db",
  "meta": "put",
  "data": "person:zCzm7e7XT"
}
```

<a name="get"></a>

### GET
[[Back To Top]](#top)

```
GET
http://localhost:3000/api/db/get?key=person:CXpkhn-3T

POST JSON and FORM
http://localhost:3000/api/db/get

body = {
  key : "person:CXpkhn-3T"
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"get","data":{"key":"person:CXpkhn-3T"}}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "get",
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
  "db": "db",
  "meta": "get",
  "data": {
    "key": "person:CX"
  }
}
```

<a name="batch"></a>

### BATCH
[[Back To Top]](#top)

```
POST JSON
http://localhost:3000/api/db/batch

body =  [
  {"type":"del","key":"old"},
  {"type":"put","key":"yamigr","value":"https://github.com/yamigr"},
  {"type":"put","key":"p:1","value":{"age":24,"avatar":"gomolo"}},
  {"type":"put","key":"p:2","value":{"age":19,"avatar":"azuzi"}}
]


Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"batch","data": [
                          {"type":"del","key":"old"},
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
  "db": "db",
  "meta": "batch",
  "data": 4
}
```

<a name="stream"></a>

### STREAM
[[Back To Top]](#top)

Options: greater / less than (gt / lt), greater / less than and equal (gte / lte), limit (limit) and reverse (reverse)

```
GET all
http://localhost:3000/api/db/stream 

GET pagenation
http://localhost:3000/api/db/stream?gt='last-key-in-stream'&limit=50

GET stream of persons
http://localhost:3000/api/db/stream?gte=person:&lte=person:~


POST JSON and FORM
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
ws://localhost:3000/api
Write
{"db":"db","meta":"stream","data": { stream-options }}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "stream",
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

<a name="keys"></a>

### KEYS
[[Back To Top]](#top)

Use the [stream-options](#stream) to get a specific stream or keep it empty. 

```
GET
http://localhost:3000/api/db/keys?<stream-options-query>

POST JSON and FORM
http://localhost:3000/api/db/keys

body = {
  <stream-options-body>
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"keys","data":{ <stream-options-body> }}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "keys",
  "data": [ ..., ..., ...]
}
```

<a name="values"></a>

### VALUES
[[Back To Top]](#top)

Use the [stream-options](#stream) to get a specific stream or keep it empty. 

```
GET
http://localhost:3000/api/db/values?<stream-options-query>

POST JSON and FORM
http://localhost:3000/api/db/values

body = {
  <stream-options-body>
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"values","data":{ <stream-options-body> }}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "values",
  "data": [ ..., ..., ...]
}
```

<a name="del"></a>

### DEL
[[Back To Top]](#top)

```
GET
http://localhost:3000/api/db/del?key=person:HSar_qa4f

POST JSON and FORM
http://localhost:3000/api/db/del

body = {
  key : "person:HSar_qa4f"
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"del","data":{"key":"person:HSar_qa4f"}}
```
#### Result
```js
{
  "err": null,
  "db": "db",
  "meta": "del",
  "data": "person:HSar_qa4f"
}
```

<a name="update"></a>

### UPDATE
[[Back To Top]](#top)

If posted by form add properties key and all the other properties without 'value'.

```
GET
http://localhost:3000/api/db/update?key=person:HSar_qa4f&value=NewName

POST JSON and FORM
http://localhost:3000/api/db/update

body = {
  key : "person:HSar_qa4f",
  value: "NewName"
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"update","data":{"key":"person:HSar_qa4f","value":"NewName"}}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "update",
  "data": "person:AEYC8Y785"
}
```
#### Result when key doesn't exist
```js
{
  "err": "NotFoundError: Key not found in database [person:HSar_qa4f]",
  "db": "db",
  "meta": "update",
  "data": "person:HSar_qa4f"
}
```

<a name="count"></a>

### COUNT
[[Back To Top]](#top)

Use the [stream-options](#stream) to count a specific stream or keep it empty to count all. 

```
GET
http://localhost:3000/api/db/count?<stream-options-query>

POST JSON and FORM
http://localhost:3000/api/db/count

body = {
  <stream-options-body>
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"count","data":{ <stream-options-body> }}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "count",
  "data": 9
}
```

<a name="filter"></a>

### FILTER
[[Back To Top]](#top)

```
GET
http://localhost:3000/api/db/filter?value=Sue

POST JSON and FORM
http://localhost:3000/api/db/filter

body = {
  value: "Sue"
}

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"filter","data":{"value":"Sue"}}
```
#### Result successful
```js
{
  "err": null,
  "db": "db",
  "meta": "filter",
  "data": [
    {
      "key": "person:9bAuxQVYw",
      "value": "Sue"
    }
    // more Sue's
  ]
}
```

<a name="select"></a>

### SELECT MULTIPLE QUERIES
[[Back To Top]](#top)

Querying the pusudb multiple-times in one step with the keywords select/list.

```
GET
http://localhost:3000/api/select/list?nav=db,stream,limit 5,gte person:,lte person:~&user=db,get,key person:AEYC8Y785

POST JSON
http://localhost:3000/api/select/list

body = [
  { name: 'nav', db: 'db', meta: 'stream', data: { limit: 5, gte: 'person:', lte : 'person:~' } },
  { name: 'user', db: 'db', meta: 'get', data: { key: 'person:AEYC8Y785' } } 
]

Websocket
ws://localhost:3000/api
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
[[Back To Top]](#top)

Use keyword hash to define a encoded query in base64.

Generate base64-string:
* browser: use functions atob and btoa
* nodejs:
```js

//example
var sendObj = {
  key : 'mykey',
  value: 'some-value' // or object
}
// create a encoded base64-string. escapeForUrl : bool to generate a get-query-friendly-string ;)
var encoded = pusudb.encodeJsonToBase64(sendObj, escapeForUrl)
// decode the base64 to json
var decoded = pusudb.decodeBase64ToJson(encoded)
```

```
GET
http://localhost:3000/api/select/list?hash=W3sibmFtZSI6Im5hdiIsImRiIjoiZGIiLCJtZXRhIjoic3RyZWFtIiwiZGF0YSI6eyJsaW1pdCI6NSwiZ3RlIjoicGVyc29uOiIsImx0ZSI6InBlcnNvbjp%2BIn19LHsibmFtZSI6InVzZXIiLCJkYiI6ImRiIiwibWV0YSI6ImdldCIsImRhdGEiOnsia2V5IjoicGVyc29uOkFFWUM4WTc4NSJ9fV0%3D

or

http://localhost:3000/api/db/stream?hash=eyJndGUiOiJwZXJzb246IiwibHRlIjoicGVyc29uOn4ifQ==


POST JSON and FORM
http://localhost:3000/api/select/list

body = {
  hash : 'W3sibmFtZSI6Im5hdiIsImRiIjoiZGIiLCJtZXRhIjoic3RyZWFtIiwiZGF0YSI6eyJsaW1pdCI6NSwiZ3RlIjoicGVyc29uOiIsImx0ZSI6InBlcnNvbjp+In19LHsibmFtZSI6InVzZXIiLCJkYiI6ImRiIiwibWV0YSI6ImdldCIsImRhdGEiOnsia2V5IjoicGVyc29uOkFFWUM4WTc4NSJ9fV0='
}

Websocket
ws://localhost:3000/api
{
   "meta": "list",
   "data": {
     "hash": "W3sibmFtZSI6Im5hdiIsImRiIjoiZGIiLCJtZXRhIjoic3RyZWFtIiwiZGF0YSI6eyJsaW1pdCI6NSwiZ3RlIjoicGVyc29uOiIsImx0ZSI6InBlcnNvbjp         +In19LHsibmFtZSI6InVzZXIiLCJkYiI6ImRiIiwibWV0YSI6ImdldCIsImRhdGEiOnsia2V5IjoicGVyc29uOkFFWUM4WTc4NSJ9fV0="
   }
}

```

<a name="subscribe"></a>

### SUBSCRIBE
[[Back To Top]](#top)

The data can be a STRING for single key or ARRAY to subscribe multiple keys. When a client put, update or publish a value, the subscribed clients receives the actual data or the key.
If a client batch multiple entries and the keys has a common substring, then the subscriber receives the batches.

Wildcard: '#'

```
Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"subscribe","data":"chat:9bAuxQVYw"}

or with wildcard

{"db":"db","meta":"subscribe","data":"chat:#"}
```
#### Message when someone put, update, delete or publish a value
```js
{
  "err": null,
  "db": "db",
  "meta": "put [, update, publish]",
  "data": {
    "key": "chat:9bAuxQVYw",
    "value": "Aloah Joe!"
  }
}

// DEL
{
  "err": null,
  "db": "db",
  "meta": "del",
  "data": "person:HSar_qa4f"
}

// BATCH
{
  "err": null,
  "db": "db",
  "meta": "batch",
  "data": {
    "key" : "chat:",
    "value" : [
      {
        "key": "chat:9bAuxQVYw",
        "value": "Aloah Joe!"
      },
      {
        "key": "chat:8_zBaVYw",
        "value": "Moin Sue!"
      },
      // other entries ...
    ]
  }
}
```

<a name="unsubscribe"></a>

### UNSUBSCRIBE
[[Back To Top]](#top)

The data can be a STRING or ARRAY to unsubscribe multiple keys. When the websocket connection is closed, the key will unsubscribe automatically.

```
Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"unsubscribe","data":"chat:9bAuxQVYw"}
```
<a name="publish"></a>

### PUBLISH
[[Back To Top]](#top)

Use meta publish to publish the data without storing.

```
GET
http://localhost:3000/api/db/publish?key=score:CXpkhn-3T&value=42

...

Websocket
ws://localhost:3000/api
Write
{"db":"db","meta":"publish","data": {"key":"person:HSar_qa4f","value":"NewName"}}
```

<a name="authors"></a>

## Authors
[[Back To Top]](#top)

* **Yannick Grund** - *Initial work* - [yamigr](https://github.com/yamigr)

<a name="license"></a>

## License
[[Back To Top]](#top)

This project is licensed under the MIT License

