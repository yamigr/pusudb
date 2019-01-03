/** 
 * Autor: yannick grund, 2018
 * This class implements the publish subscribe pattern
*/

const wildcard = require('node-wildcard')
const debug = require('debug')('pubsub')
const helpers = require('./helpers')

class PubSub {

    constructor(options){
        this.topics = {}
        this.wildcards = {}
        this.sockets = {}
        this.socketsCounter = {}
        this.block = true
        this.options = options
    }

    /**
     * 
     * @param {string} noExtDb noExtDb-name without extension (path)
     * @param {string} meta 
     * @param {object} chunk 
     * @param {object} sock 
     */
    handle(noExtDb, meta, chunk, req, sock){
        debug('db: %o, meta: %o', noExtDb, meta)
        switch(meta){
            case 'del':
                // publish delete and delete all sockets
                this.publish(noExtDb, meta, chunk.key, this.getWsKey(req))
                if(Object.keys(this.wildcards).length){
                    this.wildcardpublish(noExtDb, meta, chunk.key,  this.getWsKey(req))
                }
                this.unsubscribeAll(noExtDb + chunk.key,  this.getWsKey(req))  
            break
            case 'put':
            case 'batch':
            case 'update':
            case 'publish':
                this.publish(noExtDb, meta, chunk,  this.getWsKey(req))
                if(Object.keys(this.wildcards).length){
                    this.wildcardpublish(noExtDb, meta, chunk,  this.getWsKey(req))
                }
            break
            case 'subscribe':

                // Subscribe single or multiple
                if(typeof chunk === 'string'){
                    this.subscribe(noExtDb + chunk, this.getWsKey(req), sock)  
                }
                else{
                    for(let t in chunk){
                        this.subscribe(noExtDb + chunk[t], this.getWsKey(req), sock)         
                    }
                }
            break
            case 'unsubscribe':
                // Unsubscribe single or muliple
                if(typeof chunk === 'string'){
                    this.unsubscribe(noExtDb + chunk, this.getWsKey(req) )  
                }
                else{
                    for(let t in chunk){
                        this.unsubscribe(noExtDb + chunk[t], this.getWsKey(req) )         
                    }
                }
            break
            case 'destroy':

            // Destroy socket when ws closed or key is deleted
            this.destroy( this.getWsKey(req) )
            break;
            default:
            break
        }
    }

    publish(noExtDb, meta, chunk, token){
        let topic = typeof chunk === 'string' ? chunk : chunk.key
        let concatedTopic = noExtDb + topic
        for(let tokenIndex in this.topics[concatedTopic]){
            try{
                if(this.block){
                    if(this.topics[concatedTopic][tokenIndex] !== token){
                        if(!this.send(this.topics[concatedTopic][tokenIndex], { err : null, db : noExtDb, meta : meta, data : chunk})){
                            this.unsubscribe(concatedTopic, this.topics[concatedTopic][tokenIndex])
                        }
                    }
                }
                else{
                    if(!this.send(this.topics[concatedTopic][tokenIndex], { err : null, db : noExtDb, meta : meta, data : chunk})){
                        this.unsubscribe(concatedTopic, this.topics[concatedTopic][tokenIndex])
                    }
                }
            }
            catch(e){
                console.error(e)
            }
        }
    }

    wildcardpublish(noExtDb, meta, chunk, token){
        let topic = typeof chunk === 'string' ? chunk : chunk.key
        let concatedTopic = noExtDb + topic
        //loop the wildcard topics and check if one match, if so, publish to all sockets
        for(let card in this.wildcards){
            try {
                if(wildcard(concatedTopic, card)){
                  
                    for(let tokenIndex in this.wildcards[card]){
                        try{
                            if(this.block){
                                if(this.wildcards[card][tokenIndex] !== token){
                                    if(!this.send(this.wildcards[card][tokenIndex], { err : null, db : noExtDb, meta : meta, data : chunk})){
                                        this.unsubscribe(concatedTopic, this.wildcards[card][tokenIndex])
                                    }	
                                }
                            }
                            else{
                                if(!this.send(this.wildcards[card][tokenIndex], { err : null, db : noExtDb, meta : meta, data : chunk})){
                                    this.unsubscribe(concatedTopic, this.wildcards[card][tokenIndex])
                                }			
                            }
                        }
                        catch(e){
                            console.error(e)
                        }
                    }
                }
            }
            catch(e){
                console.error(e)
            }
        }
    }

    subscribe(topic, token, sock){
        if(topic.indexOf('#') === -1){
            this.topics[topic] =  this.topics[topic] || []

            if(this.topics[topic].indexOf( token ) === -1){
                this.increaseSocket(token, sock)
                this.topics[topic].push(token)
            }
        }
        else{
            this.wildcardsubscribe(topic, token, sock)
        }
    }

    wildcardsubscribe(topic, token, sock){
        // replace wildcard for the wildcard-package
        let card =  topic.replace(/#/g, '*')//topic.slice(0, -1) + '*'
        this.wildcards[card] =  this.wildcards[card] || []

        if(this.wildcards[card].indexOf( token ) === -1){
            this.increaseSocket(token, sock)
            this.wildcards[card].push( token )
        }
    }

    unsubscribe(topic, token){
        if(topic.indexOf('#') === -1){
            if(this.topics[topic]){
                try {
                    delete this.topics[ topic ][ this.topics[topic].indexOf( token ) ]
                    this.decreaseSocket(token)
                }
                catch(e){
                    console.error(e)
                }
            }
        }
        else{
            this.wildcardunsubscribe(topic, token)
        }
    }

    wildcardunsubscribe(topic, token){
        let card =  topic.replace(/#/g, '*')//topic.slice(0, -1) + '*'
        if(this.wildcards[card]){
            try {
                delete this.wildcards[ card ][ this.wildcards[card].indexOf( token ) ]
                this.decreaseSocket(token)
            }
            catch(e){
                console.error(e)
            }
        }

    }

    unsubscribeAll(topic, token){
        try {
            delete this.topics[topic]
            this.decreaseSocket(token)
        }
        catch(e){
            console.error(e)
        }
    }

    destroy(token){
        for(let topic in this.topics){
            try{
                delete this.topics[ topic ][ this.topics[topic].indexOf( token ) ]
                this.decreaseSocket(token)
            }
            catch(e){
                console.error(e)
            }   
        }
        this.wildcarddestroy(token)
    }


    wildcarddestroy(token){
        for(let topic in this.wildcards){
            try{
                delete this.wildcards[topic][ this.wildcards[topic].indexOf( token ) ]
                this.decreaseSocket(token)
            }
            catch(e){
                console.error(e)
            }   
        } 
    }

    convertBatch(data){
        let k = []
        let d = []

        for(let el in data){
            if(data[el].type === 'put'){
                k.push(data[el].key)
                d.push({ key : data[el].key, value : data[el].value } )
            }
        }

        if(k.length){
            k = helpers.commonSubstring(k)
            return { key : k, value : d }
        }
        else{
            return data
        }

    }

    send(token, data){
        try{
            this.sockets[ token ].send(JSON.stringify(data));
            return true	
        }
        catch(e){
            return false
        }
    }
    
    getWsKey(req){
        try{
            return req.headers['sec-websocket-key']
        }
        catch(e){
            return null
        }
    }


    increaseSocket(token, socket){
        if(token){
            this.sockets[token] = socket
            if( this.socketsCounter[token] >= 1)
            this.socketsCounter[token]++
            else
            this.socketsCounter[token] = 1
        }

    }

    decreaseSocket(token){
        if(this.socketsCounter[token]){
        this.socketsCounter[token]--
        // delete socket
        if(this.socketsCounter[token] <= 0){
            delete this.sockets[token]
            delete this.socketsCounter[token]
        }
        }
    }
}



module.exports = PubSub
