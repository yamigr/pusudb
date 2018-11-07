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

var pusudb = new Pusudb(port, host)

pusudb.listen(function(port, host){
    console.log('pusudb listening:', port, host)
})
```

<a name="middleware"></a>

## Middleware

It's possible to add custom middlewares. These can be defined for each protocol and will be called in series.

Query the pusudb in the middleware or use the database-result with req.docs.

### HTTP
```js
pusudb.use('http', function(req, res, next){
    console.log(req.headers) // HTTP-Header
    console.log(req.params.query) //GET Parameters
    console.log(req.body) // POST Body
    console.log(req.docs) // Database result-object descriped in API
    
    this.db.query('./db','get', { key : "user:abc"}, function(doc){
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
```
GET
http://localhost:3000/db/put?key=person:@key&value=Peter Pan

POST
http://localhost:3000/db/put

body = {
  key : "person:@key",
  value : "Peter Pan"
}

Websocket
ws://localhost:3000/db
Write
{"meta":"put","data":{"key":"person:@key","value":"Sue"}}
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
http://localhost:3000/db/get?key=person:CXpkhn-3T

POST
http://localhost:3000/db/get

body = {
  key : "person:CXpkhn-3T"
}

Websocket
ws://localhost:3000/db
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
http://localhost:3000/db/batch

body =  [
  {"type":"del","key":"father"},
  {"type":"put","key":"yamigr","value":"https://github.com/yamigr"},
  {"type":"put","key":"p:1","value":{"age":24,"avatar":"gomolo"}},
  {"type":"put","key":"p:2","value":{"age":19,"avatar":"azuzi"}}
]


Websocket
ws://localhost:3000/db
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

Following stream-options are implemented: greater / less than (gt / lt), greater / less than or equal (gte / lte), limit (limit) and reverse (reverse)

```
GET all
http://localhost:3000/db/stream 

GET pagenation
http://localhost:3000/db/stream?gt='last-key-in-list'&limit=50

GET stream of persons
http://localhost:3000/db/stream?gte=person:&lte=person:~


POST
http://localhost:3000/db/stream

body = {
  gt : STRING | OBJECT
  lt : STRING | OBJECT
  gte : STRING | OBJECT
  lte : STRING | OBJECT
  reverse : BOOL
  limit : INTEGER
}


Websocket
ws://localhost:3000/db
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
http://localhost:3000/db/del?key=person:HSar_qa4f

POST
http://localhost:3000/db/del

body = {
  key : "person:HSar_qa4f"
}

Websocket
ws://localhost:3000/db
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
http://localhost:3000/db/update?key=person:HSar_qa4f&value=NewName

POST
http://localhost:3000/db/update

body = {
  key : "person:HSar_qa4f",
  value: "NewName"
}

Websocket
ws://localhost:3000/db
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
http://localhost:3000/db/count?<stream-options-query>

POST
http://localhost:3000/db/count

body = {
  <stream-options-body>
}

Websocket
ws://localhost:3000/db
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
http://localhost:3000/db/filter?value=Sue

POST
http://localhost:3000/db/filter

body = {
  value: "Sue"
}

Websocket
ws://localhost:3000/db
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

<a name="subscribe"></a>

### SUBSCRIBE

The data can be a STRING or ARRAY to subscribe multiple keys.

```
Websocket
ws://localhost:3000/db
Write
{"meta":"subscribe","data":"chat:9bAuxQVYw"}
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

The data can be a STRING or ARRAY to subscribe multiple keys.

```
Websocket
ws://localhost:3000/db
Write
{"meta":"unsubscribe","data":"chat:9bAuxQVYw"}
```

<a name="authors"></a>

## Authors

* **Yannick Grund** - *Initial work* - [yamigr](https://github.com/yamigr)

<a name="license"></a>

## License

This project is licensed under the MIT License

