module.exports.convertToBuffer = function(value){
    if(typeof value === 'object'){
        value = Buffer.from(JSON.stringify(value)); 
    }
    else{
        value = Buffer.from(value)
    }
    
    return value
}

module.exports.convertFromBuffer = function(buf){
    if(Buffer.isBuffer(buf)){
        try{
            buf = JSON.parse(buf.toString());
        }
        catch(e){
            buf = buf.toString()
        }
    }

    return buf
}

module.exports.callbackNoob = function(callback){
    if(typeof callback !== 'function'){
        callback = function(){}
    }
    return callback
}

module.exports.dataToChunk = function(data, chunkSize){
    var result = []
    var len = data.length
    var start = 0
    var end = 0

    if(typeof data !== 'string' && !Buffer.isBuffer(data)){
        throw new Error('Wrong datatype to convert to chunk. Use String or Buffer.')
    }

    while(end < len){
        end += chunkSize
        if(end >= len){
            end = len
        }
        result.push(data.slice(start, end))
        start = end
    }

    return result
}

module.exports.dataFromChunk = function(data){
    var result = ''
    if(data.length){
        if(Buffer.isBuffer(data[0])){
            result = Buffer.concat(data)
        }
        else{
            result = result.concat(data)
        }
    }
    return result
}


module.exports.createHash = function(secret, id){
    return crypto.createHmac('sha256', secret)
                 .update(id)
                 .digest('hex');
  }

module.exports.dbHandler = function(_db, path, method, data, callback){
    
    switch(method){
        case 'get':
        _db.get(path, data.key, function(err, data){
            callback({ err : err, data : data})
        })
        break
        case 'put':
        _db.put(path, data, function(err){
            callback({ err : err, data : data.key})
        })
        break
        case 'del':
        _db.del(path, data.key, function(err){
            callback({ err : err, data : data.key})
        })
        break
        case 'batch':
        _db.batch(path, data, function(err){
            callback({ err : err, data : data.length})
        })
        break
        case 'stream':
        _db.stream(path, data, function(err, data){
            callback({ err : err, data : data})
        })
        break
        case 'count':
        _db.count(path, data, function(err, numb){
            callback({ err : err, data : numb})
        })
        break
        case 'filter':
        _db.filter(path, data, function(err, docs){
            callback({ err : err, data : data})
        })
        break
        case 'update':
        _db.update(path, data, function(err, docs){
            callback({ err : err, data : data})
        })

        break
        default:
        callback({ err : 'query not exist.', data : ''})
        break
    }
}