# pusudb

> pusudb is a database-framework to query the included key-value-storage by webservices or webpages.

The pusudb has a build-in REST-api and communiate with http or websocket. With websockets it's possible to subscribe certain keys to receive the data-changes in realtime on client-side.

## Installing

```sh
npm install pusudb --save
```

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

## Client http or websocket

With http it's possible to query the pusudb with a request-response-pattern like REST.
With websockets the pusudb can additionally serve a publish-subscribe-pattern. 
When a ws-client subscribe a key and another client put or update the certain value over http or ws, 
all subscribed ws-client on the certain key receive the actual data. Yaami

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

