# pusudb

> pusudb is a database-framework to query the included key-value-storage by webservices.

The database can handle http- or websocket-queries. With websockets it's possible to subscribe certain keys to receive the data-changes in realtime on client-side.

Notice: the framework is under development. Thx.

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

pusudb.listen(function(){
    console.log('pusudb listening')
})
```

## Client http or websocket
It's possible to query the pusudb with a http-request or websockets. The response is a json-object. 

With websockets it's possible to subscribe the keys in the storage. 
When the values changes by another update or put, the socket will receive the actual data.


### HTTP
* url : http://localhost/'db'/'meta'
* db : name of the database
* meta: action for the db-query
    * get (GET- or POST-request) => http://localhost/'db'/get/'key' or { key : '' } 
    * put (GET- or POST-request) => http://localhost/'db'/put/'key'?..&.. or { key : '', value : '' } 
    * del (GET- or POST-request) => http://localhost/'db'/del/'key' or { key : '' } 
    * batch (POST-request) => [{},{},{}]
    * stream (POST-request) => { gte : '', lte : '', ... } or {} for get all
    * filter (POST-request) => STRING or OBJECT with the value to filter
    * update (POST-request)  => { key : '', value : '' }
    * subscribe

### Websockets
* url : http://localhost/'db'
* db : name of the database
* data-body: { meta : '', data : ''}
* meta:
    * get 
    * put 
    * del 
    * batch 
    * stream 
    * filter 
    * update 
    * subscribe
* data:
    * get => { key : '' }
    * put => { key : '', value : '' }
    * del => { key : '' }
    * batch => [{},{},{}]
    * stream => { gte : '', lte : '', ... } or {} for get all
    * filter => STRING or OBJECT with the value to filter
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

