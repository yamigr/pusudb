/** 
 * Autor: yannick grund, 2018
 * Some helper-functions
 * 
*/
const querystring = require('querystring');
const async = require('async')

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

return value.length > 0 ? value : ''
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


module.exports.asyncMiddleware = function(self, seq, req, res, callback){
    async.forEach(seq, function(fn, next){
            try{
            fn.call(self, req, res, function(err){
                next(err)
            })
            }
            catch(e){
            console.error(e)
            throw new Error('handle middleware-function error')
            }
        }, function(err){
            callback(err, req, res)
        })

}


module.exports.decodeBase64ToJson = function(encoded){
    try{
        return JSON.parse(Buffer.from(encoded, 'base64').toString())
    }
    catch(e){
        console.error(e)
        return  {}
    }
}


module.exports.encodeJsonToBase64 = function(decoded, url){
try{
    if(url)
    return querystring.escape(Buffer.from(JSON.stringify(decoded)).toString('base64'));
    else
    return Buffer.from(JSON.stringify(decoded)).toString('base64');

}
catch(e){
    console.error(e)
    return  ''
}
}


module.exports.concatDbPath = function(path, dbname){
    return path ? path + '/' +  dbname : './' + dbname
}





module.exports.commonSubstring = function(array){
    var A = array.concat().sort(), 
    a1 = A[0], a2 = A[A.length-1], L= a1.length, i= 0;
    while(i<L && a1.charAt(i)=== a2.charAt(i)) i++;
    return a1.substring(0, i);
}

module.exports.writeKeyIfNewUniqueId = function(data , docs){
    try{
        if(data.data.key  && docs.data.key){
            data.key = docs.data.key
        }
    }
    catch(e){

    }
}
