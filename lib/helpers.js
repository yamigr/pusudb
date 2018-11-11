let crypto;
try {
  crypto = require('crypto');
} catch (err) {
  console.error('crypto support is disabled!');
}


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

module.exports.bindMiddleware = function(self, sequence){
    let binded = []
    for(let fn in sequence){
        if(typeof sequence[fn] !== 'function'){
            throw new Error('Middleware is not a function')
        }
        else{
            binded.push(sequence[fn].bind(self))
        }
    }
    return binded
  }
